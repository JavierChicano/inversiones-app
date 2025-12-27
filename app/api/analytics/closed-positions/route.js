import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAllAssets } from '@/lib/repository/asset.repository';

export async function GET(request) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Obtener todas las transacciones del usuario ordenadas por fecha
    const allTransactions = await findAllUserTransactions(userId);
    const transactions = allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Obtener tipos de assets
    const assetPrices = await findAllAssets();
    const assetTypeMap = assetPrices.reduce((acc, asset) => {
      acc[asset.ticker] = asset.type || 'STOCK';
      return acc;
    }, {});

    // Calcular datos por ticker
    const tickerData = {};
    const progressionData = [];
    let cumulativeGain = 0;
    let totalHoldingDays = 0; // Para calcular tiempo promedio de posesión
    let totalSoldQuantity = 0; // Para ponderar el tiempo de posesión

    transactions.forEach((tx) => {
      const ticker = tx.assetTicker;
      
      if (!tickerData[ticker]) {
        tickerData[ticker] = {
          ticker,
          type: assetTypeMap[ticker] || 'STOCK',
          buyQueue: [], // Cola FIFO de compras
          totalGainLoss: 0,
          totalSellCount: 0,
          totalBuyCount: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalInvested: 0,
          totalRevenue: 0,
          totalHoldingDays: 0, // Suma ponderada de días de posesión
          totalSoldQuantity: 0, // Cantidad total vendida para ponderar
        };
      }

      if (tx.type === 'BUY') {
        // Agregar compra a la cola
        tickerData[ticker].buyQueue.push({
          quantity: tx.quantity,
          pricePerUnit: tx.pricePerUnit,
          fees: tx.fees,
          date: tx.date,
        });
        tickerData[ticker].totalBuyCount++;
        tickerData[ticker].totalInvested += (tx.quantity * tx.pricePerUnit + tx.fees);
      } else if (tx.type === 'SELL') {
        let remainingToSell = tx.quantity;
        let totalCost = 0;
        const sellRevenue = tx.quantity * tx.pricePerUnit - tx.fees;
        const sellDate = new Date(tx.date);

        // Procesar FIFO
        while (remainingToSell > 0 && tickerData[ticker].buyQueue.length > 0) {
          const buy = tickerData[ticker].buyQueue[0];
          const quantityToUse = Math.min(remainingToSell, buy.quantity);
          
          // Calcular costo de esta porción
          const portionCost = quantityToUse * buy.pricePerUnit + (buy.fees * quantityToUse / buy.quantity);
          totalCost += portionCost;

          // Calcular tiempo de posesión de esta porción vendida
          const buyDate = new Date(buy.date);
          const holdingDays = Math.floor((sellDate - buyDate) / (1000 * 60 * 60 * 24));
          totalHoldingDays += holdingDays * quantityToUse; // Ponderar por cantidad vendida
          totalSoldQuantity += quantityToUse;
          
          // Agregar tiempo de posesión al ticker específico
          tickerData[ticker].totalHoldingDays += holdingDays * quantityToUse;
          tickerData[ticker].totalSoldQuantity += quantityToUse;

          // Actualizar cola
          buy.quantity -= quantityToUse;
          if (buy.quantity <= 0) {
            tickerData[ticker].buyQueue.shift();
          }

          remainingToSell -= quantityToUse;
        }

        // Calcular ganancia/pérdida de esta venta
        const portionRevenue = sellRevenue * (tx.quantity - remainingToSell) / tx.quantity;
        const gainLoss = portionRevenue - totalCost;

        tickerData[ticker].totalGainLoss += gainLoss;
        tickerData[ticker].totalSellCount++;
        tickerData[ticker].totalRevenue += portionRevenue;

        if (gainLoss > 0) {
          tickerData[ticker].winningTrades++;
        } else if (gainLoss < 0) {
          tickerData[ticker].losingTrades++;
        }

        // Agregar a progresión temporal
        cumulativeGain += gainLoss;
        progressionData.push({
          date: tx.date,
          ticker: ticker,
          gainLoss: gainLoss,
          cumulativeGain: cumulativeGain,
        });
      }
    });

    // Convertir a array y calcular métricas finales
    const closedPositions = Object.values(tickerData)
      .filter(t => t.totalSellCount > 0)
      .map(t => ({
        ticker: t.ticker,
        type: t.type,
        totalGainLoss: t.totalGainLoss,
        totalTrades: t.totalSellCount,
        buyCount: t.totalBuyCount,
        winningTrades: t.winningTrades,
        losingTrades: t.losingTrades,
        winRate: t.totalSellCount > 0 ? (t.winningTrades / t.totalSellCount) * 100 : 0,
        avgGainPerTrade: t.totalSellCount > 0 ? t.totalGainLoss / t.totalSellCount : 0,
        roi: t.totalInvested > 0 ? (t.totalGainLoss / t.totalInvested) * 100 : 0,
        totalInvested: t.totalInvested,
        totalRevenue: t.totalRevenue,
        avgHoldingDays: t.totalSoldQuantity > 0 ? Math.floor(t.totalHoldingDays / t.totalSoldQuantity) : 0,
      }))
      .sort((a, b) => b.totalGainLoss - a.totalGainLoss);

    // Calcular métricas globales
    const totalTrades = closedPositions.reduce((sum, p) => sum + p.totalTrades, 0);
    const totalGainLoss = closedPositions.reduce((sum, p) => sum + p.totalGainLoss, 0);
    const totalInvested = closedPositions.reduce((sum, p) => sum + p.totalInvested, 0);
    const totalWinning = closedPositions.reduce((sum, p) => sum + p.winningTrades, 0);
    const totalLosing = closedPositions.reduce((sum, p) => sum + p.losingTrades, 0);
    const avgHoldingDays = totalSoldQuantity > 0 ? Math.floor(totalHoldingDays / totalSoldQuantity) : 0;

    const globalMetrics = {
      totalTrades,
      totalGainLoss,
      totalInvested,
      globalROI: totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0,
      avgGainPerTrade: totalTrades > 0 ? totalGainLoss / totalTrades : 0,
      winRate: totalTrades > 0 ? (totalWinning / totalTrades) * 100 : 0,
      winningTrades: totalWinning,
      losingTrades: totalLosing,
      totalTickers: closedPositions.length,
      avgHoldingDays: avgHoldingDays,
    };

    // Tipo de cambio EUR/USD
    const eurUsdAsset = assetPrices.find(a => a.ticker === 'EURUSD');
    const eurUsdRate = eurUsdAsset?.currentPrice || 1.1;
    const usdEurRate = 1 / eurUsdRate;

    return NextResponse.json({
      closedPositions,
      progression: progressionData,
      metrics: {
        ...globalMetrics,
        totalGainLossEur: totalGainLoss * usdEurRate,
        avgGainPerTradeEur: globalMetrics.avgGainPerTrade * usdEurRate,
      },
      exchangeRate: {
        eurUsd: eurUsdRate,
      },
    });
  } catch (error) {
    console.error('Error fetching closed positions:', error);
    return NextResponse.json(
      { error: 'Error al obtener análisis de posiciones cerradas' },
      { status: 500 }
    );
  }
}
