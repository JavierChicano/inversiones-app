import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAllAssets } from '@/lib/repository/asset.repository';
import { findSnapshotsByUser } from '@/lib/repository/portfolio.repository';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sampleEvery = Math.max(1, parseInt(searchParams.get('sampleEvery') || '1', 10));
    const maxSnapshots = Math.max(0, parseInt(searchParams.get('maxSnapshots') || '0', 10));
    const onlyProgression = searchParams.get('onlyProgression') === '1';

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Obtener todas las transacciones del usuario
    const userTransactions = await findAllUserTransactions(userId);

    // Obtener histórico de snapshots para el gráfico de progresión.
    const snapshotFilters = { startDate, endDate };
    const snapshots = await findSnapshotsByUser(userId, snapshotFilters);

    // Muestreo opcional: conservar primero/último y saltar intermedios según consulta.
    let sampledSnapshots = snapshots;

    if (sampleEvery > 1 && sampledSnapshots.length > 2) {
      const descending = [...sampledSnapshots];
      const ascending = descending.reverse();
      const reduced = ascending.filter(
        (_, index) => index === 0 || index === ascending.length - 1 || index % sampleEvery === 0
      );
      sampledSnapshots = reduced.reverse();
    }

    if (maxSnapshots > 0 && sampledSnapshots.length > maxSnapshots) {
      const descending = [...sampledSnapshots];
      const ascending = descending.reverse();
      const keep = [ascending[0]];
      const step = (ascending.length - 1) / (maxSnapshots - 1);

      for (let i = 1; i < maxSnapshots - 1; i++) {
        keep.push(ascending[Math.round(i * step)]);
      }

      keep.push(ascending[ascending.length - 1]);

      const uniqueKeep = keep.filter(
        (item, index, arr) => index === 0 || item.date.getTime() !== arr[index - 1].date.getTime()
      );
      sampledSnapshots = uniqueKeep.reverse();
    }

    let progression = sampledSnapshots.map((snap) => ({
      date: new Date(snap.date).toISOString(),
      value: snap.totalValue,
      invested: snap.totalInvested,
      netGain: snap.totalValue - snap.totalInvested,
    }));

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    const transactionsInRange = userTransactions.filter((tx) => {
      const txDate = new Date(tx.date);

      if (parsedStartDate && txDate < parsedStartDate) return false;
      if (parsedEndDate && txDate > parsedEndDate) return false;

      return true;
    });

    const transactionsForChart = transactionsInRange
      .map((tx) => ({
        date: new Date(tx.date).toISOString(),
        type: tx.type,
        ticker: tx.assetTicker,
        quantity: tx.quantity,
        pricePerUnit: tx.pricePerUnit,
        fees: tx.fees,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const progressionMeta = {
      snapshotsQueried: snapshots.length,
      snapshotsReturned: progression.length,
      sampleEvery,
      maxSnapshots: maxSnapshots || null,
      transactionsReturned: transactionsForChart.length,
      range: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };

    if (onlyProgression) {
      return NextResponse.json({
        progression,
        transactions: transactionsForChart,
        progressionMeta,
      });
    }

    // Obtener precios actuales de los assets
    const assetPrices = await findAllAssets();
    const priceMap = assetPrices.reduce((acc, asset) => {
      acc[asset.ticker] = asset.currentPrice || 0;
      return acc;
    }, {});
    
    // Crear mapa de tipos de assets
    const assetTypeMap = assetPrices.reduce((acc, asset) => {
      acc[asset.ticker] = asset.type || 'STOCK';
      return acc;
    }, {});

    // Calcular portfolio actual y ganancias de posiciones cerradas
    const portfolio = {};
    let totalInvested = 0;
    let totalFees = 0;
    let totalSellProceeds = 0;
    let realizedGainLoss = 0; // Ganancia/pérdida solo de ventas
    let closedPositions = 0; // Número de ventas realizadas

    const transactions = [...userTransactions].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    transactions.forEach((tx) => {
      const ticker = tx.assetTicker;

      if (!portfolio[ticker]) {
        portfolio[ticker] = {
          ticker,
          buyQueue: [],
        };
      }

      if (tx.type === 'BUY') {
        portfolio[ticker].buyQueue.push({
          quantity: tx.quantity,
          originalQuantity: tx.quantity,
          pricePerUnit: tx.pricePerUnit,
          fees: tx.fees,
          date: tx.date,
        });

        totalInvested += tx.quantity * tx.pricePerUnit + tx.fees;
        totalFees += tx.fees;
      } else if (tx.type === 'SELL') {
        closedPositions++; // Incrementar contador de posiciones cerradas

        let remainingToSell = tx.quantity;
        let totalCost = 0;
        const sellRevenue = tx.quantity * tx.pricePerUnit - tx.fees;

        while (remainingToSell > 0 && portfolio[ticker].buyQueue.length > 0) {
          let lowestIndex = 0;
          let lowestPrice = portfolio[ticker].buyQueue[0].pricePerUnit;

          for (let i = 1; i < portfolio[ticker].buyQueue.length; i++) {
            if (portfolio[ticker].buyQueue[i].pricePerUnit < lowestPrice) {
              lowestPrice = portfolio[ticker].buyQueue[i].pricePerUnit;
              lowestIndex = i;
            }
          }

          const buy = portfolio[ticker].buyQueue[lowestIndex];
          const quantityToUse = Math.min(remainingToSell, buy.quantity);

          // Prorrateo de comisiones sobre la parte del lote que se vende
          const portionCost =
            quantityToUse * buy.pricePerUnit +
            (buy.fees * quantityToUse) / buy.originalQuantity;
          totalCost += portionCost;

          buy.quantity -= quantityToUse;
          if (buy.quantity <= 0) {
            portfolio[ticker].buyQueue.splice(lowestIndex, 1);
          }

          remainingToSell -= quantityToUse;
        }

        const soldQuantity = tx.quantity - remainingToSell;
        const portionRevenue =
          tx.quantity > 0 ? (sellRevenue * soldQuantity) / tx.quantity : 0;
        realizedGainLoss += portionRevenue - totalCost;
        totalSellProceeds += portionRevenue;
        totalFees += tx.fees;
      }
    });

    // Calcular valor actual del portfolio
    let totalCurrentValue = 0;
    let currentInvested = 0; // Dinero actualmente invertido en posiciones abiertas
    const stockDistribution = [];

    Object.values(portfolio).forEach((position) => {
      const openQuantity = position.buyQueue.reduce((sum, buy) => sum + buy.quantity, 0);

      if (openQuantity > 0) {
        const openCost = position.buyQueue.reduce((sum, buy) => {
          return sum + buy.quantity * buy.pricePerUnit + (buy.fees * buy.quantity) / buy.originalQuantity;
        }, 0);
        const currentPrice = priceMap[position.ticker] || 0;
        const currentValue = openQuantity * currentPrice;
        totalCurrentValue += currentValue;
        currentInvested += openCost; // Sumar el costo de posiciones abiertas

        const oldestOpenBuyDate = position.buyQueue.reduce((oldest, buy) => {
          if (!oldest) return buy.date;
          return new Date(buy.date) < new Date(oldest) ? buy.date : oldest;
        }, null);

        const holdingDays = oldestOpenBuyDate
          ? Math.floor((new Date() - new Date(oldestOpenBuyDate)) / (1000 * 60 * 60 * 24))
          : 0;

        stockDistribution.push({
          ticker: position.ticker,
          type: assetTypeMap[position.ticker] || 'STOCK',
          quantity: openQuantity,
          currentValue: currentValue,
          percentage: 0, // Se calculará después
          avgBuyPrice: openCost / openQuantity,
          currentPrice: currentPrice,
          gainLoss: currentValue - openCost,
          gainLossPercent: openCost > 0
            ? ((currentValue - openCost) / openCost) * 100
            : 0,
          avgHoldingDays: holdingDays,
        });
      }
    });

    // Calcular porcentajes de distribución
    stockDistribution.forEach((item) => {
      item.percentage = totalCurrentValue > 0 
        ? (item.currentValue / totalCurrentValue) * 100 
        : 0;
    });

    // Calcular métricas principales
    // currentInvested: dinero que ACTUALMENTE está invertido en posiciones abiertas
    const netTotal = realizedGainLoss; // Solo ganancias/pérdidas realizadas (ventas)
    const roi = currentInvested > 0 ? ((totalCurrentValue - currentInvested) / currentInvested) * 100 : 0; // ROI sobre posiciones abiertas
    const gainPercent = currentInvested > 0 ? ((totalCurrentValue - currentInvested) / currentInvested) * 100 : 0;

    // Calcular ganancias medias y win rate
    const positions = stockDistribution.length;
    const winningPositions = stockDistribution.filter(p => p.gainLoss > 0).length;
    const winRate = positions > 0 ? (winningPositions / positions) * 100 : 0;
    const avgGain = positions > 0 
      ? stockDistribution.reduce((sum, p) => sum + p.gainLossPercent, 0) / positions 
      : 0;

    // Si no hay snapshots, generar uno con los datos actuales
    if (progression.length === 0) {
      progression.push({
        date: new Date().toISOString(),
        value: totalCurrentValue,
        invested: currentInvested,
        netGain: netTotal,
      });
    }

    // Tipo de cambio EUR/USD (si existe en assets)
    const eurUsdAsset = assetPrices.find(a => a.ticker === 'EURUSD');
    const eurUsdRate = eurUsdAsset?.currentPrice || 1.1;
    const usdEurRate = 1 / eurUsdRate; // Conversión USD a EUR

    // IMPORTANTE: Todas las transacciones están en USD
    // Los valores base (netTotal, netInvested, totalCurrentValue) están en USD
    // Para convertir a EUR, dividimos por eurUsdRate (o multiplicamos por usdEurRate)
    return NextResponse.json({
      stats: {
        netTotal: {
          usd: netTotal, // Valor en dólares (original)
          eur: netTotal * usdEurRate, // Convertir USD a EUR
        },
        invested: {
          usd: currentInvested, // Valor en dólares (original)
          eur: currentInvested * usdEurRate, // Convertir USD a EUR
        },
        portfolioTotal: {
          usd: totalCurrentValue, // Valor en dólares (original)
          eur: totalCurrentValue * usdEurRate, // Convertir USD a EUR
        },
        roi: roi,
        avgGain: avgGain,
        gainPercent: gainPercent,
        winRate: winRate,
        totalFees: totalFees,        closedPositions: closedPositions,      },
      stockDistribution: stockDistribution.sort((a, b) => b.percentage - a.percentage),
      progression: progression,
      transactions: transactionsForChart,
      progressionMeta,
      exchangeRate: {
        eurUsd: eurUsdRate,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del dashboard' },
      { status: 500 }
    );
  }
}
