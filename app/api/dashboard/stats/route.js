import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAllAssets } from '@/lib/repository/asset.repository';
import { findSnapshotsByUser } from '@/lib/repository/portfolio.repository';

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

    // Obtener todas las transacciones del usuario
    const userTransactions = await findAllUserTransactions(userId);

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

    userTransactions.forEach((tx) => {
      const ticker = tx.assetTicker;
      
      if (!portfolio[ticker]) {
        portfolio[ticker] = {
          ticker,
          quantity: 0,
          totalCost: 0,
          avgBuyPrice: 0,
          firstBuyDate: null, // Para calcular tiempo de posesión medio
        };
      }

      if (tx.type === 'BUY') {
        // Registrar fecha de primera compra
        // Si la cantidad era 0 o muy cercana a 0 (posición cerrada), iniciamos nueva fecha
        if (portfolio[ticker].quantity < 0.00000001) {
          portfolio[ticker].firstBuyDate = tx.date;
        } else if (!portfolio[ticker].firstBuyDate || new Date(tx.date) < new Date(portfolio[ticker].firstBuyDate)) {
          // Solo usar fecha más antigua si hay posiciones abiertas
          console.log(`[${ticker}] Posición existente (${portfolio[ticker].quantity}) - Manteniendo firstBuyDate: ${portfolio[ticker].firstBuyDate}`);
        }
        
        // Añadir la nueva compra al portfolio
        portfolio[ticker].quantity += tx.quantity;
        portfolio[ticker].totalCost += tx.quantity * tx.pricePerUnit + tx.fees;
        totalInvested += tx.quantity * tx.pricePerUnit + tx.fees;
        totalFees += tx.fees;
        
        // Calcular precio medio ponderado: totalCost incluye todas las compras + fees
        portfolio[ticker].avgBuyPrice = portfolio[ticker].totalCost / portfolio[ticker].quantity;
      } else if (tx.type === 'SELL') {
        closedPositions++; // Incrementar contador de posiciones cerradas
        
        const avgBuyPriceAtSell = portfolio[ticker].quantity > 0 
          ? portfolio[ticker].totalCost / portfolio[ticker].quantity 
          : 0;
        
        // Calcular ganancia/pérdida realizada en esta venta
        const sellRevenue = tx.quantity * tx.pricePerUnit - tx.fees;
        const sellCost = tx.quantity * avgBuyPriceAtSell;
        realizedGainLoss += (sellRevenue - sellCost);
        
        portfolio[ticker].quantity -= tx.quantity;
        portfolio[ticker].totalCost -= sellCost;
        totalSellProceeds += sellRevenue;
        totalFees += tx.fees;
        
        // Si la posición se cerró completamente (con tolerancia para redondeo), reiniciar firstBuyDate
        if (portfolio[ticker].quantity < 0.00000001 || portfolio[ticker].totalCost < 0.01) {
          portfolio[ticker].firstBuyDate = null;
          portfolio[ticker].quantity = 0; // Asegurar que sea exactamente 0
          portfolio[ticker].totalCost = 0; // Asegurar que sea exactamente 0
        }
      }
    });

    // Calcular valor actual del portfolio
    let totalCurrentValue = 0;
    let currentInvested = 0; // Dinero actualmente invertido en posiciones abiertas
    const stockDistribution = [];

    Object.values(portfolio).forEach((position) => {
      if (position.quantity > 0) {
        const currentPrice = priceMap[position.ticker] || 0;
        const currentValue = position.quantity * currentPrice;
        totalCurrentValue += currentValue;
        currentInvested += position.totalCost; // Sumar el costo de posiciones abiertas

        // Calcular días de posesión
        const holdingDays = position.firstBuyDate 
          ? Math.floor((new Date() - new Date(position.firstBuyDate)) / (1000 * 60 * 60 * 24))
          : 0;

        stockDistribution.push({
          ticker: position.ticker,
          type: assetTypeMap[position.ticker] || 'STOCK',
          quantity: position.quantity,
          currentValue: currentValue,
          percentage: 0, // Se calculará después
          avgBuyPrice: position.avgBuyPrice,
          currentPrice: currentPrice,
          gainLoss: currentValue - position.totalCost,
          gainLossPercent: position.totalCost > 0 
            ? ((currentValue - position.totalCost) / position.totalCost) * 100 
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

    // Obtener histórico de snapshots para el gráfico de progresión
    const snapshots = await findSnapshotsByUser(userId, { limit: 1000 });

    const progression = snapshots.map((snap) => ({
      date: new Date(snap.date).toISOString(),
      value: snap.totalValue,
      invested: snap.totalInvested,
      netGain: snap.totalValue - snap.totalInvested,
    }));

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

    // Preparar transacciones para el gráfico (últimas 1000 transacciones)
    const transactionsForChart = userTransactions
      .map(tx => ({
        date: new Date(tx.date).toISOString(),
        type: tx.type,
        ticker: tx.assetTicker,
        quantity: tx.quantity,
        pricePerUnit: tx.pricePerUnit,
        fees: tx.fees,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-1000);

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
