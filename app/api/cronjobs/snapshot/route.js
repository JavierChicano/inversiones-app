import { NextResponse } from 'next/server';
import { db } from '@/lib/db/index';
import { assets, transactions, users } from '@/lib/db/schema';
import { eq, inArray, notInArray } from 'drizzle-orm';
import { createSnapshot } from '@/lib/repository/portfolio.repository';

export async function POST(req) {
  try {
    // Verificar autenticación
    const authHeader = req.headers.get('authorization');
    const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCronJob) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('=== Cron Job: Snapshot y Sanitización ===');

    // 1. SANITIZAR ASSETS - Eliminar assets que ningún usuario tiene
    console.log('--- Sanitizando tabla de assets ---');
    
    // Obtener todos los tickers únicos que SÍ tienen los usuarios
    const tickersInUse = await db
      .selectDistinct({ ticker: transactions.assetTicker })
      .from(transactions);

    const tickersInUseList = tickersInUse.map(t => t.ticker);
    
    // Siempre mantener EURUSD (necesario para conversiones)
    if (!tickersInUseList.includes('EURUSD')) {
      tickersInUseList.push('EURUSD');
    }

    // Obtener todos los assets de la tabla
    const allAssets = await db.select({ ticker: assets.ticker }).from(assets);
    const allTickers = allAssets.map(a => a.ticker);

    // Identificar assets huérfanos (en la tabla pero sin usuarios)
    const orphanedTickers = allTickers.filter(ticker => !tickersInUseList.includes(ticker));

    if (orphanedTickers.length > 0) {
      console.log(`Eliminando ${orphanedTickers.length} assets sin usuarios: [${orphanedTickers.join(', ')}]`);
      await db
        .delete(assets)
        .where(inArray(assets.ticker, orphanedTickers));
    } else {
      console.log('No hay assets huérfanos para eliminar');
    }

    // 2. GUARDAR SNAPSHOTS - Para todos los usuarios
    console.log('--- Guardando snapshots ---');
    
    const allUsers = await db.select({ id: users.id }).from(users);
    const userIds = allUsers.map(u => u.id);

    if (userIds.length === 0) {
      console.log('No hay usuarios en el sistema');
      return NextResponse.json({ 
        success: true,
        message: 'Sanitización completada, no hay usuarios para snapshots',
        assetsDeleted: orphanedTickers.length,
        snapshots: 0
      });
    }

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

    const snapshotResults = await Promise.all(snapshotPromises);
    const successfulSnapshots = snapshotResults.filter(r => r.success);
    
    console.log(`Snapshots creados: ${successfulSnapshots.length}/${userIds.length}`);
    console.log('======================================');

    return NextResponse.json({ 
      success: true, 
      message: `Proceso completado: ${orphanedTickers.length} assets eliminados, ${successfulSnapshots.length} snapshots creados`,
      assetsDeleted: orphanedTickers.length,
      deletedTickers: orphanedTickers,
      snapshots: successfulSnapshots.length,
      snapshotDetails: snapshotResults,
    });

  } catch (error) {
    console.error("Error en snapshot:", error);
    return NextResponse.json(
      { error: 'Error en proceso de snapshot', details: error.message }, 
      { status: 500 }
    );
  }
}
