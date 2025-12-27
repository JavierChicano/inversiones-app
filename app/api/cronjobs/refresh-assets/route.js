import { NextResponse } from 'next/server';
import { db } from '@/lib/db/index';
import { assets, transactions, users } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { fetchAssetData } from '@/lib/services/assetData.service';
import { shouldUpdateAsset, getMarketStatus } from '@/lib/utils/marketHours';

// Función para dividir arrays en lotes (batching)
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId } = body;

    // Si viene el header Authorization con el CRON_SECRET, es una llamada del cron job de GitHub Actions
    const authHeader = req.headers.get('authorization');
    const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    // Si no es cron job, se requiere userId
    if (!isCronJob && !userId) {
      return NextResponse.json({ error: 'User ID requerido' }, { status: 400 });
    }

    let userIds = [];
    
    if (isCronJob) {
      // Cron job: procesar TODOS los usuarios
      console.log('=== Cron Job: Refresh All Users ===');
      const allUsers = await db.select({ id: users.id }).from(users);
      userIds = allUsers.map(u => u.id);
      
      if (userIds.length === 0) {
        return NextResponse.json({ message: 'No hay usuarios en el sistema' });
      }
    } else {
      // Petición normal: procesar solo el usuario especificado
      userIds = [userId];
    }

    // Obtener todos los tickers de los usuarios a procesar
    const userTransactions = await db
      .selectDistinct({ ticker: transactions.assetTicker, userId: transactions.userId })
      .from(transactions)
      .where(inArray(transactions.userId, userIds));

    if (userTransactions.length === 0) {
      return NextResponse.json({ message: 'No hay activos para actualizar' });
    }

    const tickersList = [...new Set(userTransactions.map(t => t.ticker))];
    
    // Siempre incluir EURUSD
    if (!tickersList.includes('EURUSD')) {
      tickersList.push('EURUSD');
    }

    // Obtener info de la tabla Assets para saber el tipo (CRYPTO/STOCK)
    const assetsToUpdate = await db
      .select()
      .from(assets)
      .where(inArray(assets.ticker, tickersList));

    // Verificar estado del mercado
    const marketStatus = getMarketStatus();
    console.log(`Estado del mercado: ${marketStatus.message} (${marketStatus.etTime})`);

    // Filtrar assets según si deben actualizarse (considerando horario de mercado)
    const assetsToActuallyUpdate = isCronJob 
      ? assetsToUpdate.filter(asset => shouldUpdateAsset(asset.type))
      : assetsToUpdate; // Si no es cron job, actualizar todo (petición manual de usuario)

    if (assetsToActuallyUpdate.length === 0) {
      const skippedStocks = assetsToUpdate.filter(a => a.type === 'STOCK');
      console.log(`No hay assets para actualizar. Mercado cerrado, ${skippedStocks.length} acciones omitidas.`);
      return NextResponse.json({ 
        message: 'Mercado cerrado, no se actualizaron acciones',
        marketStatus: marketStatus.message,
        skipped: skippedStocks.length
      });
    }

    // Log de assets omitidos por mercado cerrado
    if (isCronJob) {
      const skippedAssets = assetsToUpdate.filter(asset => !shouldUpdateAsset(asset.type));
      if (skippedAssets.length > 0) {
        const skippedStocks = skippedAssets.filter(a => a.type === 'STOCK');
        console.log(`Assets omitidos (mercado cerrado): ${skippedStocks.length} acciones - [${skippedStocks.map(a => a.ticker).join(', ')}]`);
      }
    }

    /* =========================================
       PROCESAMIENTO CON BATCHING
       ========================================= */

    // 1. Separar Stocks de otros tipos (Crypto/Fiat)
    const stocksToUpdate = assetsToActuallyUpdate.filter(a => a.type === 'STOCK');
    const othersToUpdate = assetsToActuallyUpdate.filter(a => a.type !== 'STOCK');

    const results = [];

    // --- A. PROCESAMIENTO DE STOCKS (BATCHING TWELVE DATA) ---
    // Agrupar de 8 en 8 para respetar límite de 8 calls/min
    const stockChunks = chunkArray(stocksToUpdate, 8);

    for (const chunk of stockChunks) {
      const tickers = chunk.map(a => a.ticker).join(',');
      try {
        // Llamada batch a Twelve Data
        const apiKey = process.env.TWELVE_DATA_API_KEY;
        const url = `https://api.twelvedata.com/price?symbol=${tickers}&apikey=${apiKey}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Twelve Data API Error ${response.status}`);
        }
        
        const data = await response.json();
        
        // Procesar respuesta (formato diferente si es 1 o varios símbolos)
        for (const asset of chunk) {
          let price = null;
          
          if (chunk.length === 1 && data.price) {
            // Respuesta para un solo símbolo
            price = parseFloat(data.price);
          } else if (data[asset.ticker] && data[asset.ticker].price) {
            // Respuesta para múltiples símbolos
            price = parseFloat(data[asset.ticker].price);
          }

          if (price && !isNaN(price)) {
            await db
              .update(assets)
              .set({ 
                currentPrice: price, 
                lastUpdated: new Date() 
              })
              .where(eq(assets.ticker, asset.ticker));
            
            results.push({ ticker: asset.ticker, success: true, type: 'STOCK' });
          } else {
            results.push({ 
              ticker: asset.ticker, 
              success: false, 
              type: 'STOCK', 
              error: 'No price data in batch response' 
            });
          }
        }

        console.log(`✓ Batch Twelve Data: ${chunk.length} stocks - [${tickers}]`);
      } catch (error) {
        console.error(`Error en batch [${tickers}]:`, error);
        // Marcar todo el lote como fallido
        chunk.forEach(a => {
          results.push({ 
            ticker: a.ticker, 
            success: false, 
            type: 'STOCK',
            error: error.message 
          });
        });
      }
    }

    // --- B. PROCESAMIENTO DE OTROS (CRYPTO/FIAT) ---
    // Mantener lógica individual para Crypto y Fiat
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
          error: error.message 
        };
      }
    });

    const otherResults = await Promise.all(otherPromises);
    results.push(...otherResults);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Separar por tipo para el log
    const cryptos = successful.filter(r => r.type === 'CRYPTO');
    const stocks = successful.filter(r => r.type === 'STOCK' || r.type === 'FIAT');
    const batchCount = Math.ceil(stocksToUpdate.length / 8);

    // Log de estadísticas de API
    console.log('=== API Usage Stats (refresh-assets) ===');
    console.log(`Twelve Data: ${batchCount} llamada(s) batch (${stocks.length} stocks) - Tickers: [${stocks.map(r => r.ticker).join(', ')}]`);
    console.log(`CoinGecko: ${cryptos.length} consulta(s) - Tickers: [${cryptos.map(r => r.ticker).join(', ')}]`);
    console.log(`Total assets actualizados: ${successful.length}`);
    if (failed.length > 0) {
      console.log(`Errores: ${failed.length} - Tickers: [${failed.map(r => r.ticker).join(', ')}]`);
    }
    console.log('======================================');

    return NextResponse.json({ 
        success: true, 
        message: `Actualizados ${successful.length} activos${isCronJob ? ` para ${userIds.length} usuarios` : ''}`,
        marketStatus: isCronJob ? marketStatus.message : undefined,
        total: assetsToActuallyUpdate.length,
        updated: successful.length,
        failed: failed.length,
        failures: failed.length > 0 ? failed : undefined,
    });

  } catch (error) {
    console.error("Error en refresh-assets:", error);
    return NextResponse.json(
        { error: 'Error actualizando cartera', details: error.message }, 
        { status: 500 }
    );
  }
}
