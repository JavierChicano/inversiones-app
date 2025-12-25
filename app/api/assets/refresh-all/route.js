import { NextResponse } from 'next/server';
import { db } from '@/lib/db/index';
import { assets, transactions, users } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { fetchAssetData } from '@/lib/services/assetData.service';
import { createSnapshot } from '@/lib/repository/portfolio.repository';

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

    // Actualizar cada asset usando el service
    const updatePromises = assetsToUpdate.map(async (asset) => {
      try {
        // Obtener datos actualizados usando el service
        const externalData = await fetchAssetData(asset.ticker, asset.type);

        // Actualizar el asset en la base de datos
        await db
          .update(assets)
          .set({
            currentPrice: externalData.currentPrice, // Mantener precisión completa
            lastUpdated: new Date(),
          })
          .where(eq(assets.ticker, asset.ticker));

        return { ticker: asset.ticker, success: true, type: asset.type };
      } catch (error) {
        console.error(`Error actualizando ${asset.ticker}:`, error);
        return { ticker: asset.ticker, success: false, type: asset.type, error: error.message };
      }
    });

    const results = await Promise.all(updatePromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Separar por tipo para el log
    const cryptos = successful.filter(r => r.type === 'CRYPTO');
    const stocks = successful.filter(r => r.type === 'STOCK' || r.type === 'FIAT');

    // Log de estadísticas de API
    console.log('=== API Usage Stats (refresh-all) ===');
    console.log(`Twelve Data: ${stocks.length} consulta(s) - Tickers: [${stocks.map(r => r.ticker).join(', ')}]`);
    console.log(`CoinGecko: ${cryptos.length} consulta(s) - Tickers: [${cryptos.map(r => r.ticker).join(', ')}]`);
    console.log(`Total assets actualizados: ${successful.length}`);
    if (failed.length > 0) {
      console.log(`Errores: ${failed.length} - Tickers: [${failed.map(r => r.ticker).join(', ')}]`);
    }

    // Si es cron job, guardar snapshots de todos los usuarios
    let snapshotResults = [];
    if (isCronJob) {
      console.log('=== Guardando Snapshots ===');
      
      // Obtener precios actualizados
      const assetPrices = await db.select().from(assets);
      const priceMap = assetPrices.reduce((acc, asset) => {
        acc[asset.ticker] = asset.currentPrice || 0;
        return acc;
      }, {});

      // Para cada usuario, calcular y guardar snapshot
      const snapshotPromises = userIds.map(async (uid) => {
        try {
          // Obtener transacciones del usuario
          const userTxs = await db
            .select()
            .from(transactions)
            .where(eq(transactions.userId, uid));

          if (userTxs.length === 0) {
            return { userId: uid, success: false, reason: 'no_transactions' };
          }

          // Calcular portfolio actual
          const portfolio = {};

          userTxs.forEach((tx) => {
            if (!portfolio[tx.assetTicker]) {
              portfolio[tx.assetTicker] = { quantity: 0, totalCost: 0 };
            }

            if (tx.type === 'BUY') {
              portfolio[tx.assetTicker].quantity += tx.quantity;
              portfolio[tx.assetTicker].totalCost += tx.quantity * tx.pricePerUnit + tx.fees;
            } else if (tx.type === 'SELL') {
              const avgBuyPrice = portfolio[tx.assetTicker].quantity > 0
                ? portfolio[tx.assetTicker].totalCost / portfolio[tx.assetTicker].quantity
                : 0;
              portfolio[tx.assetTicker].quantity -= tx.quantity;
              portfolio[tx.assetTicker].totalCost -= tx.quantity * avgBuyPrice;
            }
          });

          // Calcular valor total actual
          let totalValue = 0;
          let currentInvested = 0;

          Object.entries(portfolio).forEach(([ticker, position]) => {
            if (position.quantity > 0) {
              const currentPrice = priceMap[ticker] || 0;
              totalValue += position.quantity * currentPrice;
              currentInvested += position.totalCost;
            }
          });

          // Guardar snapshot
          await createSnapshot({
            userId: uid,
            date: new Date(),
            totalInvested: currentInvested,
            totalValue: totalValue,
            cashBalance: 0,
          });

          return { 
            userId: uid, 
            success: true, 
            totalValue, 
            totalInvested: currentInvested 
          };
        } catch (error) {
          console.error(`Error creando snapshot para usuario ${uid}:`, error);
          return { userId: uid, success: false, error: error.message };
        }
      });

      snapshotResults = await Promise.all(snapshotPromises);
      const successfulSnapshots = snapshotResults.filter(r => r.success);
      console.log(`Snapshots creados: ${successfulSnapshots.length}/${userIds.length}`);
    }

    console.log('======================================');

    return NextResponse.json({ 
        success: true, 
        message: `Actualizados ${successful.length} activos${isCronJob ? ` para ${userIds.length} usuarios` : ''}`,
        total: assetsToUpdate.length,
        updated: successful.length,
        failed: failed.length,
        failures: failed.length > 0 ? failed : undefined,
        snapshots: isCronJob ? snapshotResults.filter(r => r.success).length : undefined,
    });

  } catch (error) {
    console.error("Error en refresh-all:", error);
    return NextResponse.json(
        { error: 'Error actualizando cartera', details: error.message }, 
        { status: 500 }
    );
  }
}