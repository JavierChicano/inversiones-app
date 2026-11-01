import { NextResponse } from 'next/server';
import { isCronRequest } from '@/lib/auth/request';
import { findAllAssets, setAssetsActive } from '@/lib/repository/asset.repository';
import { findAllTransactions } from '@/lib/repository/transaction.repository';
import { findAllWatchlistTickers } from '@/lib/repository/watchlist.repository';
import { findAllUserIds } from '@/lib/repository/user.repository';
import { createSnapshots } from '@/lib/repository/portfolio.repository';
import { jsonError } from '@/lib/api/http';
import { buildHoldings, buildPortfolio, summarizeOpenPositions } from '@/lib/utils/portfolio';

const FX_TICKER = 'EURUSD';
const HOLDING_EPSILON = 0.000001;

export const maxDuration = 60;

/**
 * POST /api/cronjobs/snapshot (protegido con CRON_SECRET)
 *  1. Activa/desactiva assets según haya posiciones abiertas o estén en alguna watchlist.
 *  2. Guarda un snapshot (valor e invertido) de la cartera de cada usuario, con el mismo
 *     método de valoración que el dashboard.
 */
export async function POST(request) {
  try {
    if (!isCronRequest(request)) {
      return jsonError('No autorizado', 401);
    }

    console.log('=== Cron Job: Snapshot y Sanitización ===');

    const now = new Date();
    const [allTransactions, watchlistTickers, allAssets, userIds] = await Promise.all([
      findAllTransactions(),
      findAllWatchlistTickers(),
      findAllAssets(),
      findAllUserIds(),
    ]);

    // 1. Estado de assets
    const holdings = buildHoldings(allTransactions);
    const tickersToKeepActive = new Set([FX_TICKER]);
    for (const [ticker, quantity] of Object.entries(holdings)) {
      if (quantity > HOLDING_EPSILON) tickersToKeepActive.add(ticker.trim());
    }
    for (const ticker of watchlistTickers) {
      tickersToKeepActive.add(String(ticker).trim());
    }

    const tickersToDeactivate = allAssets
      .filter((asset) => !tickersToKeepActive.has(asset.ticker) && asset.isActive !== false)
      .map((asset) => asset.ticker);
    const tickersToActivate = allAssets
      .filter((asset) => tickersToKeepActive.has(asset.ticker) && asset.isActive === false)
      .map((asset) => asset.ticker);

    await setAssetsActive(tickersToDeactivate, false);
    await setAssetsActive(tickersToActivate, true);

    console.log(`Assets desactivados: ${tickersToDeactivate.length} [${tickersToDeactivate.join(', ')}]`);
    console.log(`Assets reactivados: ${tickersToActivate.length} [${tickersToActivate.join(', ')}]`);

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Gestión de assets completada, no hay usuarios para snapshots',
        assetsDeactivated: tickersToDeactivate.length,
        assetsActivated: tickersToActivate.length,
        snapshots: 0,
      });
    }

    // 2. Snapshots por usuario
    const priceMap = {};
    for (const asset of allAssets) {
      priceMap[asset.ticker] = asset.currentPrice || 0;
    }

    const transactionsByUser = new Map();
    for (const tx of allTransactions) {
      if (!transactionsByUser.has(tx.userId)) transactionsByUser.set(tx.userId, []);
      transactionsByUser.get(tx.userId).push(tx);
    }

    const snapshotResults = [];
    const rowsToInsert = [];

    for (const userId of userIds) {
      const userTransactions = transactionsByUser.get(userId);
      if (!userTransactions || userTransactions.length === 0) {
        snapshotResults.push({ userId, success: false, reason: 'no_transactions' });
        continue;
      }

      const portfolio = buildPortfolio(userTransactions);
      const { totalCurrentValue, currentInvested } = summarizeOpenPositions(portfolio, { priceMap, now });

      rowsToInsert.push({ userId, date: now, totalInvested: currentInvested, totalValue: totalCurrentValue });
      snapshotResults.push({ userId, success: true, totalValue: totalCurrentValue, totalInvested: currentInvested });
    }

    try {
      await createSnapshots(rowsToInsert);
    } catch (error) {
      console.error('Error guardando snapshots:', error);
      for (const result of snapshotResults) {
        if (result.success) {
          result.success = false;
          result.error = error.message;
        }
      }
    }

    const successfulSnapshots = snapshotResults.filter((result) => result.success);
    console.log(`Snapshots creados: ${successfulSnapshots.length}/${userIds.length}`);
    console.log('======================================');

    return NextResponse.json({
      success: true,
      message: `Proceso completado: ${tickersToDeactivate.length} assets desactivados, ${successfulSnapshots.length} snapshots creados`,
      assetsDeactivated: tickersToDeactivate.length,
      deactivatedTickers: tickersToDeactivate,
      assetsActivated: tickersToActivate.length,
      snapshots: successfulSnapshots.length,
      snapshotDetails: snapshotResults,
    });
  } catch (error) {
    console.error('Error en snapshot:', error);
    return NextResponse.json({ error: 'Error en proceso de snapshot', details: error.message }, { status: 500 });
  }
}
