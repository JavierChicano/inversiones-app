import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAssetsByTickers } from '@/lib/repository/asset.repository';
import { findSnapshotsByUser } from '@/lib/repository/portfolio.repository';
import { jsonError } from '@/lib/api/http';
import { toValidDate } from '@/lib/validation/common';
import { buildDashboardStats, buildPortfolio, sampleSeries, toTime } from '@/lib/utils/portfolio';
import { DEFAULT_EUR_USD_RATE } from '@/lib/utils/currencyExchangeMetrics';

const FX_TICKER = 'EURUSD';

function parseIntParam(value, fallback, min) {
  const number = parseInt(value ?? '', 10);
  return Number.isFinite(number) ? Math.max(min, number) : fallback;
}

/**
 * GET /api/dashboard/stats
 * Query: startDate, endDate (rango de snapshots), sampleEvery, maxSnapshots, onlyProgression=1
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const startDate = toValidDate(searchParams.get('startDate'));
    const endDate = toValidDate(searchParams.get('endDate'));
    const sampleEvery = parseIntParam(searchParams.get('sampleEvery'), 1, 1);
    const maxSnapshots = parseIntParam(searchParams.get('maxSnapshots'), 0, 0);
    const onlyProgression = searchParams.get('onlyProgression') === '1';

    const [userTransactions, snapshots] = await Promise.all([
      findAllUserTransactions(auth.userId),
      findSnapshotsByUser(auth.userId, { startDate, endDate }),
    ]);

    // Snapshots llegan en orden descendente; la progresión se devuelve en orden cronológico
    const ascending = [...snapshots].reverse();
    const sampledSnapshots = sampleSeries(ascending, { sampleEvery, maxItems: maxSnapshots });

    const progression = sampledSnapshots.map((snap) => ({
      date: new Date(snap.date).toISOString(),
      value: snap.totalValue,
      invested: snap.totalInvested,
      netGain: snap.totalValue - snap.totalInvested,
    }));

    const startTime = startDate ? startDate.getTime() : null;
    const endTime = endDate ? endDate.getTime() : null;

    const transactionsForChart = userTransactions
      .filter((tx) => {
        const txTime = toTime(tx.date);
        if (startTime !== null && txTime < startTime) return false;
        if (endTime !== null && txTime > endTime) return false;
        return true;
      })
      .sort((a, b) => toTime(a.date) - toTime(b.date))
      .map((tx) => ({
        date: new Date(tx.date).toISOString(),
        type: tx.type,
        ticker: tx.assetTicker,
        quantity: tx.quantity,
        pricePerUnit: tx.pricePerUnit,
        fees: tx.fees,
      }));

    const progressionMeta = {
      snapshotsQueried: snapshots.length,
      snapshotsReturned: progression.length,
      sampleEvery,
      maxSnapshots: maxSnapshots || null,
      transactionsReturned: transactionsForChart.length,
      range: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
      },
    };

    if (onlyProgression) {
      return NextResponse.json({ progression, transactions: transactionsForChart, progressionMeta });
    }

    const tickers = [...new Set(userTransactions.map((tx) => tx.assetTicker)), FX_TICKER];
    const assetRows = await findAssetsByTickers(tickers);

    const priceMap = {};
    const typeMap = {};
    for (const asset of assetRows) {
      priceMap[asset.ticker] = asset.currentPrice || 0;
      typeMap[asset.ticker] = asset.type || 'STOCK';
    }

    const eurUsdRate = priceMap[FX_TICKER] > 0 ? priceMap[FX_TICKER] : DEFAULT_EUR_USD_RATE;
    const usdEurRate = 1 / eurUsdRate;

    const portfolio = buildPortfolio(userTransactions);
    const { stats, stockDistribution, totalCurrentValue, currentInvested } = buildDashboardStats(portfolio, {
      priceMap,
      typeMap,
    });

    if (progression.length === 0) {
      progression.push({
        date: new Date().toISOString(),
        value: totalCurrentValue,
        invested: currentInvested,
        netGain: stats.netTotal,
      });
    }

    // Todas las transacciones están en USD; EUR se obtiene con el tipo EURUSD de la tabla assets
    return NextResponse.json({
      stats: {
        netTotal: { usd: stats.netTotal, eur: stats.netTotal * usdEurRate },
        invested: { usd: stats.invested, eur: stats.invested * usdEurRate },
        portfolioTotal: { usd: stats.portfolioTotal, eur: stats.portfolioTotal * usdEurRate },
        roi: stats.roi,
        avgGain: stats.avgGain,
        gainPercent: stats.gainPercent,
        winRate: stats.winRate,
        totalFees: stats.totalFees,
        closedPositions: stats.closedPositions,
      },
      stockDistribution,
      progression,
      transactions: transactionsForChart,
      progressionMeta,
      exchangeRate: { eurUsd: eurUsdRate },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return jsonError('Error al obtener estadísticas del dashboard', 500);
  }
}
