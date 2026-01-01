import { NextResponse } from 'next/server';
import { db } from '@/lib/db/index';
import { assets, transactions, users, watchlist } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
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

    // 1. SANITIZAR ASSETS - Eliminar assets que nadie posee actualmente
    console.log('--- Sanitizando tabla de assets ---');
    
    // A. Obtener todas las transacciones de TODOS los usuarios
    const allTransactions = await db
      .select({ 
        ticker: transactions.assetTicker, 
        type: transactions.type, 
        quantity: transactions.quantity 
      })
      .from(transactions);

    // B. Calcular Holdings (Cantidad neta) por Ticker
    const holdingsMap = new Map();

    for (const tx of allTransactions) {
        const current = holdingsMap.get(tx.ticker) || 0;
        // Sumamos si es compra, restamos si es venta
        if (tx.type === 'BUY') {
            holdingsMap.set(tx.ticker, current + tx.quantity);
        } else if (tx.type === 'SELL') {
            holdingsMap.set(tx.ticker, current - tx.quantity);
        }
    }

    // C. Filtrar tickers que tienen saldo positivo (> 0.000001 para evitar errores de float)
    const activeHoldingTickers = [];
    holdingsMap.forEach((qty, ticker) => {
        if (qty > 0.000001) {
            activeHoldingTickers.push(ticker);
        }
    });

    console.log(`Tickers con posiciones abiertas: ${activeHoldingTickers.length}`);

    // D. Obtener tickers en Watchlist (Estos se quedan SIEMPRE, aunque no tengas saldo)
    const tickersInWatchlist = await db
      .selectDistinct({ ticker: watchlist.assetTicker })
      .from(watchlist);
    const watchlistList = tickersInWatchlist.map(t => t.ticker);

    // E. Lista FINAL de intocables (Posiciones abiertas + Watchlist + EURUSD)
    // Usamos Set para eliminar duplicados y .trim() por seguridad
    const tickersToKeep = new Set([
        ...activeHoldingTickers.map(t => t.trim()),
        ...watchlistList.map(t => t.trim())
    ]);
    
    // Aseguramos que EURUSD nunca se borre
    tickersToKeep.add('EURUSD');

    // F. Borrar lo que sobra
    const allAssets = await db.select({ ticker: assets.ticker }).from(assets);
    
    // Identificar los que NO están en la lista de 'Keep'
    const tickersToDelete = allAssets
        .map(a => a.ticker)
        .filter(ticker => !tickersToKeep.has(ticker));

    if (tickersToDelete.length > 0) {
      console.log(`🗑️ Eliminando ${tickersToDelete.length} assets inactivos:`);
      console.log(`   Tickers: [${tickersToDelete.join(', ')}]`);
      
      await db
        .delete(assets)
        .where(inArray(assets.ticker, tickersToDelete));
      
      console.log(`✅ Limpieza completada.`);
    } else {
      console.log('✓ Tabla optimizada: Solo activos necesarios en memoria.');
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
        assetsDeleted: tickersToDelete.length,
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
      message: `Proceso completado: ${tickersToDelete.length} assets eliminados, ${successfulSnapshots.length} snapshots creados`,
      assetsDeleted: tickersToDelete.length,
      deletedTickers: tickersToDelete,
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
