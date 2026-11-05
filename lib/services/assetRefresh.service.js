import { db } from '@/lib/db/index';
import { assets, transactions, users } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import {
  CRYPTO_BATCH_SIZE,
  STOCK_BATCH_SIZE,
  chunkArray,
  fetchAssetPrice,
  fetchCryptoPrices,
  fetchStockPrices,
} from '@/lib/services/assetData.service';
import { getMarketStatus, shouldUpdateAsset } from '@/lib/utils/marketHours';
import { findOpenLeveragedTickersByUsers } from '@/lib/repository/leverage.repository';

export const FX_TICKER = 'EURUSD';

async function savePrice(ticker, price, now) {
  await db.update(assets).set({ currentPrice: price, lastUpdated: now }).where(eq(assets.ticker, ticker));
}

/**
 * Actualiza en lotes los precios de un grupo de assets del mismo tipo.
 * Nunca escribe un precio inválido: si el proveedor falla, el precio anterior se conserva.
 */
async function refreshBatch(assetList, type, fetchBatch, batchSize, now) {
  const results = [];

  for (const chunk of chunkArray(assetList, batchSize)) {
    const tickers = chunk.map((asset) => asset.ticker);
    let prices;

    try {
      prices = await fetchBatch(tickers);
    } catch (error) {
      console.error(`Error en batch ${type} [${tickers.join(', ')}]:`, error?.message || error);
      for (const ticker of tickers) {
        results.push({ ticker, type, success: false, error: error?.message || String(error) });
      }
      continue;
    }

    for (const ticker of tickers) {
      const price = prices.get(ticker);
      if (!price) {
        results.push({ ticker, type, success: false, error: 'Precio no disponible en la respuesta' });
        continue;
      }

      try {
        await savePrice(ticker, price, now);
        results.push({ ticker, type, success: true, price });
      } catch (error) {
        results.push({ ticker, type, success: false, error: error?.message || String(error) });
      }
    }
  }

  return results;
}

/**
 * Refresca los precios de los assets en los que operan los usuarios indicados (o todos, en modo cron).
 * @param {{ userIds?: string[], isCronJob?: boolean, now?: Date }} options
 */
export async function refreshAssetsForUsers({ userIds = [], isCronJob = false, now = new Date() } = {}) {
  let normalizedUserIds = userIds.filter(Boolean);

  if (isCronJob) {
    const allUsers = await db.select({ id: users.id }).from(users);
    normalizedUserIds = allUsers.map((user) => user.id);

    if (normalizedUserIds.length === 0) {
      return { message: 'No hay usuarios en el sistema', total: 0, updated: 0, failed: 0, failures: undefined };
    }
  }

  if (normalizedUserIds.length === 0) {
    throw new Error('User ID requerido');
  }

  const [userTransactions, leveragedTickers] = await Promise.all([
    db
      .selectDistinct({ ticker: transactions.assetTicker })
      .from(transactions)
      .where(inArray(transactions.userId, normalizedUserIds)),
    findOpenLeveragedTickersByUsers(normalizedUserIds),
  ]);

  if (userTransactions.length === 0 && leveragedTickers.length === 0) {
    return { message: 'No hay activos para actualizar', total: 0, updated: 0, failed: 0, failures: undefined };
  }

  // Activos operados al contado + activos con posiciones apalancadas abiertas
  const tickersList = [...new Set([...userTransactions.map((transaction) => transaction.ticker), ...leveragedTickers])];
  if (!tickersList.includes(FX_TICKER)) {
    tickersList.push(FX_TICKER);
  }

  const assetsToUpdate = await db.select().from(assets).where(inArray(assets.ticker, tickersList));

  const marketStatus = getMarketStatus(now);
  console.log(`Estado del mercado: ${marketStatus.message} (${marketStatus.etTime})`);

  const assetsToActuallyUpdate = isCronJob
    ? assetsToUpdate.filter((asset) => asset.isActive !== false && shouldUpdateAsset(asset.type, now))
    : assetsToUpdate;

  if (assetsToActuallyUpdate.length === 0) {
    const skippedStocks = assetsToUpdate.filter((asset) => asset.type === 'STOCK');
    console.log(`No hay assets para actualizar. Mercado cerrado, ${skippedStocks.length} acciones omitidas.`);

    return {
      message: 'Mercado cerrado, no se actualizaron acciones',
      marketStatus: marketStatus.message,
      skipped: skippedStocks.length,
      total: 0,
      updated: 0,
      failed: 0,
      failures: undefined,
    };
  }

  if (isCronJob) {
    const inactiveAssets = assetsToUpdate.filter((asset) => asset.isActive === false);
    const skippedStocks = assetsToUpdate.filter(
      (asset) => asset.isActive !== false && asset.type === 'STOCK' && !shouldUpdateAsset(asset.type, now)
    );

    if (inactiveAssets.length > 0) {
      console.log(`Assets inactivos omitidos: ${inactiveAssets.map((asset) => asset.ticker).join(', ')}`);
    }
    if (skippedStocks.length > 0) {
      console.log(`Acciones omitidas (mercado cerrado): ${skippedStocks.map((asset) => asset.ticker).join(', ')}`);
    }
  }

  // Los índices se cotizan en Twelve Data con el mismo endpoint que las acciones
  const stocks = assetsToActuallyUpdate.filter((asset) => asset.type === 'STOCK' || asset.type === 'INDEX');
  const cryptos = assetsToActuallyUpdate.filter((asset) => asset.type === 'CRYPTO');
  const fiats = assetsToActuallyUpdate.filter((asset) => asset.type === 'FIAT');

  const results = [
    ...(await refreshBatch(stocks, 'STOCK', fetchStockPrices, STOCK_BATCH_SIZE, now)),
    ...(await refreshBatch(cryptos, 'CRYPTO', fetchCryptoPrices, CRYPTO_BATCH_SIZE, now)),
  ];

  for (const asset of fiats) {
    try {
      const price = await fetchAssetPrice(asset.ticker, asset.type);
      await savePrice(asset.ticker, price, now);
      results.push({ ticker: asset.ticker, type: asset.type, success: true, price });
    } catch (error) {
      console.error(`Error actualizando ${asset.ticker}:`, error?.message || error);
      results.push({ ticker: asset.ticker, type: asset.type, success: false, error: error?.message || String(error) });
    }
  }

  const successful = results.filter((result) => result.success);
  const failed = results.filter((result) => !result.success);

  console.log('=== API Usage Stats (refresh-assets) ===');
  console.log(
    `Twelve Data: ${Math.ceil(stocks.length / STOCK_BATCH_SIZE) + fiats.length} llamada(s) - ` +
      `Stocks: [${stocks.map((asset) => asset.ticker).join(', ')}] Forex: [${fiats.map((asset) => asset.ticker).join(', ')}]`
  );
  console.log(
    `CoinGecko: ${Math.ceil(cryptos.length / CRYPTO_BATCH_SIZE)} llamada(s) - Tickers: [${cryptos.map((asset) => asset.ticker).join(', ')}]`
  );
  console.log(`Total assets actualizados: ${successful.length}`);
  if (failed.length > 0) {
    console.log(`Errores: ${failed.length} - Tickers: [${failed.map((result) => result.ticker).join(', ')}]`);
  }
  console.log('======================================');

  return {
    success: true,
    message: `Actualizados ${successful.length} activos${isCronJob ? ` para ${normalizedUserIds.length} usuarios` : ''}`,
    marketStatus: isCronJob ? marketStatus.message : undefined,
    total: assetsToActuallyUpdate.length,
    updated: successful.length,
    failed: failed.length,
    failures: failed.length > 0 ? failed : undefined,
  };
}
