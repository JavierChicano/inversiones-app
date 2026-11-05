import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAssetsByTickers } from '@/lib/repository/asset.repository';
import { jsonError } from '@/lib/api/http';
import { buildPortfolio, summarizeClosedPositions } from '@/lib/utils/portfolio';
import { DEFAULT_EUR_USD_RATE } from '@/lib/utils/currencyExchangeMetrics';
import { findLeveragedPositionsByUser } from '@/lib/repository/leverage.repository';
import { enrichLeveragedPositions, mergeLeveragedIntoClosedAnalysis } from '@/lib/utils/leverage';

const FX_TICKER = 'EURUSD';

/**
 * GET /api/analytics/closed-positions
 * Análisis de ventas realizadas (lotes "lowest cost first") y de cierres apalancados (CFD).
 * Importes por ticker en EUR, métricas globales en USD (con equivalentes en EUR).
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const [transactions, leveragedRows] = await Promise.all([
      findAllUserTransactions(auth.userId),
      findLeveragedPositionsByUser(auth.userId, { status: 'CLOSED' }),
    ]);
    const tickers = [
      ...new Set([...transactions.map((tx) => tx.assetTicker), ...leveragedRows.map((row) => row.assetTicker)]),
      FX_TICKER,
    ];
    const assetRows = await findAssetsByTickers(tickers);

    const typeMap = {};
    let eurUsdRate = DEFAULT_EUR_USD_RATE;
    for (const asset of assetRows) {
      typeMap[asset.ticker] = asset.type || 'STOCK';
      if (asset.ticker === FX_TICKER && asset.currentPrice > 0) eurUsdRate = asset.currentPrice;
    }
    const usdEurRate = 1 / eurUsdRate;
    const toEur = (value) => value * usdEurRate;

    const portfolio = buildPortfolio(transactions);
    const spotAnalysis = summarizeClosedPositions(portfolio, { typeMap });

    // Los cierres apalancados (CFD) entran en el mismo análisis: garantía como invertido, P&L neto como resultado
    const assetMap = new Map(assetRows.map((asset) => [asset.ticker, asset]));
    const { closedPositions: closedLeveraged } = enrichLeveragedPositions(leveragedRows, assetMap);
    const { closedPositions: closedPositionsUsd, progression, metrics } = mergeLeveragedIntoClosedAnalysis(
      spotAnalysis,
      closedLeveraged
    );

    const closedPositions = closedPositionsUsd
      .map((position) => ({
        ...position,
        trades: position.trades.map((trade) => ({
          ...trade,
          revenue: toEur(trade.revenue),
          invested: toEur(trade.invested),
          gainLoss: toEur(trade.gainLoss),
        })),
        totalGainLoss: toEur(position.totalGainLoss),
        avgGainPerTrade: toEur(position.avgGainPerTrade),
        totalInvested: toEur(position.totalInvested),
        totalRevenue: toEur(position.totalRevenue),
      }))
      .sort((a, b) => b.totalGainLoss - a.totalGainLoss);

    return NextResponse.json({
      closedPositions,
      progression,
      metrics: {
        ...metrics,
        totalGainLossEur: toEur(metrics.totalGainLoss),
        avgGainPerTradeEur: toEur(metrics.avgGainPerTrade),
        spot: {
          ...metrics.spot,
          totalGainLossEur: toEur(metrics.spot.totalGainLoss),
          totalInvestedEur: toEur(metrics.spot.totalInvested),
          avgGainPerTradeEur: toEur(metrics.spot.avgGainPerTrade),
        },
        leverage: {
          ...metrics.leverage,
          totalGainLossEur: toEur(metrics.leverage.totalGainLoss),
          totalInvestedEur: toEur(metrics.leverage.totalInvested),
          avgGainPerTradeEur: toEur(metrics.leverage.avgGainPerTrade),
        },
      },
      exchangeRate: { eurUsd: eurUsdRate },
    });
  } catch (error) {
    console.error('Error fetching closed positions:', error);
    return jsonError('Error al obtener análisis de posiciones cerradas', 500);
  }
}
