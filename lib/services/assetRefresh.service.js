import { db } from '@/lib/db/index';
import { assets, transactions, users } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { fetchAssetData } from '@/lib/services/assetData.service';
import { shouldUpdateAsset, getMarketStatus } from '@/lib/utils/marketHours';

function chunkArray(array, size) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

export async function refreshAssetsForUsers({ userIds = [], isCronJob = false } = {}) {
  let normalizedUserIds = userIds.filter(Boolean);

  if (isCronJob) {
    const allUsers = await db.select({ id: users.id }).from(users);
    normalizedUserIds = allUsers.map((user) => user.id);

    if (normalizedUserIds.length === 0) {
      return {
        message: 'No hay usuarios en el sistema',
        total: 0,
        updated: 0,
        failed: 0,
        failures: undefined,
      };
    }
  }

  if (normalizedUserIds.length === 0) {
    throw new Error('User ID requerido');
  }

  const userTransactions = await db
    .selectDistinct({ ticker: transactions.assetTicker, userId: transactions.userId })
    .from(transactions)
    .where(inArray(transactions.userId, normalizedUserIds));

  if (userTransactions.length === 0) {
    return {
      message: 'No hay activos para actualizar',
      total: 0,
      updated: 0,
      failed: 0,
      failures: undefined,
    };
  }

  const tickersList = [...new Set(userTransactions.map((transaction) => transaction.ticker))];

  if (!tickersList.includes('EURUSD')) {
    tickersList.push('EURUSD');
  }

  const assetsToUpdate = await db
    .select()
    .from(assets)
    .where(inArray(assets.ticker, tickersList));

  const marketStatus = getMarketStatus();
  console.log(`Estado del mercado: ${marketStatus.message} (${marketStatus.etTime})`);

  const assetsToActuallyUpdate = isCronJob
    ? assetsToUpdate.filter((asset) => asset.isActive !== false && shouldUpdateAsset(asset.type))
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
    const skippedAssets = assetsToUpdate.filter(
      (asset) => asset.isActive !== false && !shouldUpdateAsset(asset.type)
    );

    if (inactiveAssets.length > 0) {
      console.log(
        `Assets inactivos omitidos: ${inactiveAssets.length} - [${inactiveAssets.map((asset) => asset.ticker).join(', ')}]`
      );
    }

    if (skippedAssets.length > 0) {
      const skippedStocks = skippedAssets.filter((asset) => asset.type === 'STOCK');
      console.log(
        `Assets omitidos (mercado cerrado): ${skippedStocks.length} acciones - [${skippedStocks.map((asset) => asset.ticker).join(', ')}]`
      );
    }
  }

  const stocksToUpdate = assetsToActuallyUpdate.filter((asset) => asset.type === 'STOCK');
  const othersToUpdate = assetsToActuallyUpdate.filter((asset) => asset.type !== 'STOCK');

  const results = [];
  const stockChunks = chunkArray(stocksToUpdate, 8);

  for (const chunk of stockChunks) {
    const tickers = chunk.map((asset) => asset.ticker).join(',');

    try {
      const apiKey = process.env.TWELVE_DATA_API_KEY;
      const url = `https://api.twelvedata.com/price?symbol=${tickers}&apikey=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Twelve Data API Error ${response.status}`);
      }

      const data = await response.json();

      for (const asset of chunk) {
        let price = null;

        if (chunk.length === 1 && data.price) {
          price = parseFloat(data.price);
        } else if (data[asset.ticker] && data[asset.ticker].price) {
          price = parseFloat(data[asset.ticker].price);
        }

        if (price && !isNaN(price)) {
          await db
            .update(assets)
            .set({
              currentPrice: price,
              lastUpdated: new Date(),
            })
            .where(eq(assets.ticker, asset.ticker));

          results.push({ ticker: asset.ticker, success: true, type: 'STOCK' });
        } else {
          results.push({
            ticker: asset.ticker,
            success: false,
            type: 'STOCK',
            error: 'No price data in batch response',
          });
        }
      }

      console.log(`✓ Batch Twelve Data: ${chunk.length} stocks - [${tickers}]`);
    } catch (error) {
      console.error(`Error en batch [${tickers}]:`, error);

      chunk.forEach((asset) => {
        results.push({
          ticker: asset.ticker,
          success: false,
          type: 'STOCK',
          error: error.message,
        });
      });
    }
  }

  const otherPromises = othersToUpdate.map(async (asset) => {
    try {
      const externalData = await fetchAssetData(asset.ticker, asset.type);

      await db
        .update(assets)
        .set({
          currentPrice: externalData.currentPrice,
          lastUpdated: new Date(),
        })
        .where(eq(assets.ticker, asset.ticker));

      return { ticker: asset.ticker, success: true, type: asset.type };
    } catch (error) {
      console.error(`Error actualizando ${asset.ticker}:`, error);
      return {
        ticker: asset.ticker,
        success: false,
        type: asset.type,
        error: error.message,
      };
    }
  });

  const otherResults = await Promise.all(otherPromises);
  results.push(...otherResults);

  const successful = results.filter((result) => result.success);
  const failed = results.filter((result) => !result.success);

  const cryptos = successful.filter((result) => result.type === 'CRYPTO');
  const stocks = successful.filter((result) => result.type === 'STOCK' || result.type === 'FIAT');
  const batchCount = Math.ceil(stocksToUpdate.length / 8);

  console.log('=== API Usage Stats (refresh-assets) ===');
  console.log(
    `Twelve Data: ${batchCount} llamada(s) batch (${stocks.length} stocks) - Tickers: [${stocks.map((result) => result.ticker).join(', ')}]`
  );
  console.log(`CoinGecko: ${cryptos.length} consulta(s) - Tickers: [${cryptos.map((result) => result.ticker).join(', ')}]`);
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