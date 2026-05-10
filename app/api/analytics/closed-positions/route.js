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
          trades: [], // Detalle por operación (ventas)
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
          originalQuantity: tx.quantity,
          pricePerUnit: tx.pricePerUnit,
          fees: tx.fees,
          date: tx.date,
        });
        tickerData[ticker].totalBuyCount++;
        // Nota: no acumulamos `totalInvested` aquí porque ese valor
        // debe representar solo el coste de las porciones que ya se han vendido.
      } else if (tx.type === 'SELL') {
        let remainingToSell = tx.quantity;
        let totalCost = 0;
        const sellRevenue = tx.quantity * tx.pricePerUnit - tx.fees;
        const sellDate = new Date(tx.date);

        // Procesar "Lowest Cost First" - vender primero las compras más baratas
        let sellHoldingDaysSum = 0;
        while (remainingToSell > 0 && tickerData[ticker].buyQueue.length > 0) {
          // Encontrar la compra con el precio más bajo
          let lowestIndex = 0;
          let lowestPrice = tickerData[ticker].buyQueue[0].pricePerUnit;
          
          for (let i = 1; i < tickerData[ticker].buyQueue.length; i++) {
            if (tickerData[ticker].buyQueue[i].pricePerUnit < lowestPrice) {
              lowestPrice = tickerData[ticker].buyQueue[i].pricePerUnit;
              lowestIndex = i;
            }
          }
          
          const buy = tickerData[ticker].buyQueue[lowestIndex];
          const quantityToUse = Math.min(remainingToSell, buy.quantity);
          
          // Calcular costo de esta porción usando la cantidad ORIGINAL para la prorratización de comisiones
          const portionCost = quantityToUse * buy.pricePerUnit + (buy.fees * quantityToUse / buy.originalQuantity);
          totalCost += portionCost;

          // Calcular tiempo de posesión de esta porción vendida
          const buyDate = new Date(buy.date);
          const holdingDays = Math.floor((sellDate - buyDate) / (1000 * 60 * 60 * 24));
          totalHoldingDays += holdingDays * quantityToUse; // Ponderar por cantidad vendida
          totalSoldQuantity += quantityToUse;
          
          // Agregar tiempo de posesión al ticker específico
          tickerData[ticker].totalHoldingDays += holdingDays * quantityToUse;
          tickerData[ticker].totalSoldQuantity += quantityToUse;
          sellHoldingDaysSum += holdingDays * quantityToUse;

          // Actualizar cola
          buy.quantity -= quantityToUse;
          if (buy.quantity <= 0) {
            tickerData[ticker].buyQueue.splice(lowestIndex, 1);
          }

          remainingToSell -= quantityToUse;
        }

        // Calcular ganancia/pérdida de esta venta
        const portionRevenue = sellRevenue * (tx.quantity - remainingToSell) / tx.quantity;
        const gainLoss = portionRevenue - totalCost;

        // Acumular el coste real asociado a las porciones vendidas
        tickerData[ticker].totalInvested += totalCost;

        // Detalle de la venta (operación) para poder desplegar
        const soldQuantity = tx.quantity - remainingToSell;
        const avgHoldingDaysForSell = soldQuantity > 0 ? Math.floor(sellHoldingDaysSum / soldQuantity) : 0;
        tickerData[ticker].trades.push({
          date: tx.date,
          quantity: soldQuantity,
          revenue: portionRevenue,
          invested: totalCost,
          gainLoss,
          roi: totalCost > 0 ? (gainLoss / totalCost) * 100 : 0,
          holdingDays: avgHoldingDaysForSell,
        });

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

    // Tipo de cambio EUR/USD
    const eurUsdAsset = assetPrices.find(a => a.ticker === 'EURUSD');
    const eurUsdRate = eurUsdAsset?.currentPrice || 1.1;
    const usdEurRate = 1 / eurUsdRate;

    const toEur = (value) => value * usdEurRate;

    // Convertir a array y calcular métricas finales
    const closedPositionsUsd = Object.values(tickerData)
      .filter(t => t.totalSellCount > 0)
      .map(t => ({
        ticker: t.ticker,
        type: t.type,
        trades: (t.trades || []).sort((a,b) => new Date(b.date) - new Date(a.date)),
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

    // Calcular métricas globales en USD para mantener la trazabilidad original
    const totalTrades = closedPositionsUsd.reduce((sum, p) => sum + p.totalTrades, 0);
    const totalGainLoss = closedPositionsUsd.reduce((sum, p) => sum + p.totalGainLoss, 0);
    const totalInvested = closedPositionsUsd.reduce((sum, p) => sum + p.totalInvested, 0);
    const totalWinning = closedPositionsUsd.reduce((sum, p) => sum + p.winningTrades, 0);
    const totalLosing = closedPositionsUsd.reduce((sum, p) => sum + p.losingTrades, 0);
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
      totalTickers: closedPositionsUsd.length,
      avgHoldingDays: avgHoldingDays,
    };

    const closedPositions = closedPositionsUsd.map((position) => ({
      ...position,
      trades: (position.trades || []).map((trade) => ({
        ...trade,
        revenue: toEur(trade.revenue),
        invested: toEur(trade.invested),
        gainLoss: toEur(trade.gainLoss),
        roi: trade.roi,
      })),
      totalGainLoss: toEur(position.totalGainLoss),
      avgGainPerTrade: toEur(position.avgGainPerTrade),
      totalInvested: toEur(position.totalInvested),
      totalRevenue: toEur(position.totalRevenue),
    }))
      .sort((a, b) => b.totalGainLoss - a.totalGainLoss);

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
