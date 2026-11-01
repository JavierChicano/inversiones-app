/**
 * Motor de cálculo de cartera compartido por el dashboard, el análisis de posiciones
 * cerradas y el cron de snapshots. Única fuente de verdad para el P&L.
 *
 * Método de asignación de lotes: "lowest cost first" (cada venta consume primero los lotes
 * de compra más baratos; a igual precio, el más antiguo). Las comisiones de compra se
 * prorratean según la fracción del lote vendida. Todos los importes están en USD.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {*} value @returns {number} timestamp en ms (0 si la fecha no es válida) */
export function toTime(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Días completos entre dos fechas (nunca negativo) */
export function daysBetween(from, to) {
  return Math.max(0, Math.floor((toTime(to) - toTime(from)) / DAY_MS));
}

/**
 * Ordena las transacciones cronológicamente (fecha ascendente; a igual fecha, por id ascendente).
 * @param {Array} transactions
 * @returns {Array}
 */
export function sortTransactionsChronologically(transactions) {
  return [...transactions].sort(
    (a, b) => toTime(a.date) - toTime(b.date) || (Number(a.id) || 0) - (Number(b.id) || 0)
  );
}

function createPosition(ticker) {
  return {
    ticker,
    lots: [],
    buyCount: 0,
    sellCount: 0,
    trades: [],
    totalGainLoss: 0,
    totalInvested: 0, // coste de las porciones ya vendidas
    totalRevenue: 0,
    winningTrades: 0,
    losingTrades: 0,
    holdingDaysWeighted: 0,
    soldQuantity: 0,
  };
}

/**
 * Reproduce todas las transacciones y devuelve el estado de la cartera.
 * @param {Array<{assetTicker:string,type:'BUY'|'SELL',quantity:number,pricePerUnit:number,fees?:number,date:*}>} transactions
 * @returns {{
 *   positions: Map<string, object>,
 *   realizedTrades: Array<object>,
 *   totals: { totalInvested:number, totalFees:number, totalSellProceeds:number, realizedGainLoss:number, closedPositions:number }
 * }}
 */
export function buildPortfolio(transactions = []) {
  const positions = new Map();
  const realizedTrades = [];
  const totals = {
    totalInvested: 0, // suma bruta de todas las compras (coste + comisiones)
    totalFees: 0,
    totalSellProceeds: 0,
    realizedGainLoss: 0,
    closedPositions: 0, // número de ventas
  };

  let cumulativeGain = 0;

  for (const tx of sortTransactionsChronologically(transactions)) {
    const ticker = tx.assetTicker;
    const quantity = Number(tx.quantity) || 0;
    const price = Number(tx.pricePerUnit) || 0;
    const fees = Number(tx.fees) || 0;

    let position = positions.get(ticker);
    if (!position) {
      position = createPosition(ticker);
      positions.set(ticker, position);
    }

    if (tx.type === 'BUY') {
      position.lots.push({
        quantity,
        originalQuantity: quantity,
        pricePerUnit: price,
        fees,
        date: tx.date,
      });
      position.buyCount += 1;
      totals.totalInvested += quantity * price + fees;
      totals.totalFees += fees;
      continue;
    }

    if (tx.type !== 'SELL') continue;

    totals.closedPositions += 1;
    totals.totalFees += fees;

    let remaining = quantity;
    let cost = 0;
    let holdingDaysSum = 0;

    while (remaining > 0 && position.lots.length > 0) {
      let lowestIndex = 0;
      for (let i = 1; i < position.lots.length; i += 1) {
        if (position.lots[i].pricePerUnit < position.lots[lowestIndex].pricePerUnit) {
          lowestIndex = i;
        }
      }

      const lot = position.lots[lowestIndex];
      const used = Math.min(remaining, lot.quantity);
      const lotFees = lot.originalQuantity > 0 ? (lot.fees * used) / lot.originalQuantity : 0;

      cost += used * lot.pricePerUnit + lotFees;
      holdingDaysSum += daysBetween(lot.date, tx.date) * used;

      lot.quantity -= used;
      if (lot.quantity <= 0) {
        position.lots.splice(lowestIndex, 1);
      }

      remaining -= used;
    }

    const soldQuantity = quantity - remaining;
    const sellRevenue = quantity * price - fees;
    const revenue = quantity > 0 ? (sellRevenue * soldQuantity) / quantity : 0;
    const gainLoss = revenue - cost;
    const holdingDays = soldQuantity > 0 ? Math.floor(holdingDaysSum / soldQuantity) : 0;

    cumulativeGain += gainLoss;

    const trade = {
      ticker,
      date: tx.date,
      quantity: soldQuantity,
      revenue,
      invested: cost,
      gainLoss,
      roi: cost > 0 ? (gainLoss / cost) * 100 : 0,
      holdingDays,
      cumulativeGain,
    };

    position.trades.push(trade);
    position.sellCount += 1;
    position.totalInvested += cost;
    position.totalRevenue += revenue;
    position.totalGainLoss += gainLoss;
    position.holdingDaysWeighted += holdingDaysSum;
    position.soldQuantity += soldQuantity;
    if (gainLoss > 0) position.winningTrades += 1;
    else if (gainLoss < 0) position.losingTrades += 1;

    realizedTrades.push(trade);
    totals.realizedGainLoss += gainLoss;
    totals.totalSellProceeds += revenue;
  }

  return { positions, realizedTrades, totals };
}

/** Coste abierto de un lote (precio + comisión prorrateada) */
function lotCost(lot) {
  return (
    lot.quantity * lot.pricePerUnit +
    (lot.originalQuantity > 0 ? (lot.fees * lot.quantity) / lot.originalQuantity : 0)
  );
}

/**
 * Resume las posiciones abiertas valoradas a precio actual.
 * @param {{positions: Map<string, object>}} portfolio
 * @param {{ priceMap?: Record<string, number>, typeMap?: Record<string, string>, now?: Date }} options
 * @returns {{ stockDistribution: Array, totalCurrentValue: number, currentInvested: number }}
 */
export function summarizeOpenPositions(portfolio, { priceMap = {}, typeMap = {}, now = new Date() } = {}) {
  const stockDistribution = [];
  let totalCurrentValue = 0;
  let currentInvested = 0;

  for (const position of portfolio.positions.values()) {
    const openQuantity = position.lots.reduce((sum, lot) => sum + lot.quantity, 0);
    if (openQuantity <= 0) continue;

    const openCost = position.lots.reduce((sum, lot) => sum + lotCost(lot), 0);
    const currentPrice = Number(priceMap[position.ticker]) || 0;
    const currentValue = openQuantity * currentPrice;

    totalCurrentValue += currentValue;
    currentInvested += openCost;

    const openLots = [...position.lots]
      .sort((a, b) => toTime(b.date) - toTime(a.date))
      .map((lot) => {
        const invested = lotCost(lot);
        const lotCurrentValue = lot.quantity * currentPrice;

        return {
          date: lot.date,
          quantity: lot.quantity,
          originalQuantity: lot.originalQuantity,
          pricePerUnit: lot.pricePerUnit,
          fees: lot.fees,
          invested,
          currentValue: lotCurrentValue,
          gainLoss: lotCurrentValue - invested,
          gainLossPercent: invested > 0 ? ((lotCurrentValue - invested) / invested) * 100 : 0,
          holdingDays: lot.date ? daysBetween(lot.date, now) : 0,
        };
      });

    const oldestOpenBuyDate = position.lots.reduce((oldest, lot) => {
      if (!oldest) return lot.date;
      return toTime(lot.date) < toTime(oldest) ? lot.date : oldest;
    }, null);

    stockDistribution.push({
      ticker: position.ticker,
      type: typeMap[position.ticker] || 'STOCK',
      quantity: openQuantity,
      currentValue,
      percentage: 0,
      avgBuyPrice: openCost / openQuantity,
      currentPrice,
      gainLoss: currentValue - openCost,
      gainLossPercent: openCost > 0 ? ((currentValue - openCost) / openCost) * 100 : 0,
      avgHoldingDays: oldestOpenBuyDate ? daysBetween(oldestOpenBuyDate, now) : 0,
      openLots,
    });
  }

  for (const item of stockDistribution) {
    item.percentage = totalCurrentValue > 0 ? (item.currentValue / totalCurrentValue) * 100 : 0;
  }

  stockDistribution.sort((a, b) => b.percentage - a.percentage);

  return { stockDistribution, totalCurrentValue, currentInvested };
}

/**
 * Estadísticas principales del dashboard a partir de la cartera y los precios actuales.
 * @returns {{ stats: object, stockDistribution: Array, totalCurrentValue: number, currentInvested: number }}
 */
export function buildDashboardStats(portfolio, options = {}) {
  const { stockDistribution, totalCurrentValue, currentInvested } = summarizeOpenPositions(portfolio, options);
  const { totals } = portfolio;

  const positions = stockDistribution.length;
  const winningPositions = stockDistribution.filter((p) => p.gainLoss > 0).length;
  const unrealizedPercent =
    currentInvested > 0 ? ((totalCurrentValue - currentInvested) / currentInvested) * 100 : 0;

  return {
    stats: {
      netTotal: totals.realizedGainLoss,
      invested: currentInvested,
      portfolioTotal: totalCurrentValue,
      roi: unrealizedPercent,
      gainPercent: unrealizedPercent,
      avgGain:
        positions > 0 ? stockDistribution.reduce((sum, p) => sum + p.gainLossPercent, 0) / positions : 0,
      winRate: positions > 0 ? (winningPositions / positions) * 100 : 0,
      totalFees: totals.totalFees,
      closedPositions: totals.closedPositions,
    },
    stockDistribution,
    totalCurrentValue,
    currentInvested,
  };
}

/**
 * Análisis de posiciones cerradas (en USD) por ticker, progresión de ganancias y métricas globales.
 * @param {{positions: Map<string, object>, realizedTrades: Array}} portfolio
 * @param {{ typeMap?: Record<string, string> }} options
 */
export function summarizeClosedPositions(portfolio, { typeMap = {} } = {}) {
  const closedPositions = [...portfolio.positions.values()]
    .filter((position) => position.sellCount > 0)
    .map((position) => ({
      ticker: position.ticker,
      type: typeMap[position.ticker] || 'STOCK',
      trades: [...position.trades]
        .sort((a, b) => toTime(b.date) - toTime(a.date))
        .map(({ date, quantity, revenue, invested, gainLoss, roi, holdingDays }) => ({
          date,
          quantity,
          revenue,
          invested,
          gainLoss,
          roi,
          holdingDays,
        })),
      totalGainLoss: position.totalGainLoss,
      totalTrades: position.sellCount,
      buyCount: position.buyCount,
      winningTrades: position.winningTrades,
      losingTrades: position.losingTrades,
      winRate: position.sellCount > 0 ? (position.winningTrades / position.sellCount) * 100 : 0,
      avgGainPerTrade: position.sellCount > 0 ? position.totalGainLoss / position.sellCount : 0,
      roi: position.totalInvested > 0 ? (position.totalGainLoss / position.totalInvested) * 100 : 0,
      totalInvested: position.totalInvested,
      totalRevenue: position.totalRevenue,
      avgHoldingDays:
        position.soldQuantity > 0 ? Math.floor(position.holdingDaysWeighted / position.soldQuantity) : 0,
    }))
    .sort((a, b) => b.totalGainLoss - a.totalGainLoss);

  const progression = portfolio.realizedTrades.map((trade) => ({
    date: trade.date,
    ticker: trade.ticker,
    gainLoss: trade.gainLoss,
    cumulativeGain: trade.cumulativeGain,
  }));

  const totalTrades = closedPositions.reduce((sum, p) => sum + p.totalTrades, 0);
  const totalGainLoss = closedPositions.reduce((sum, p) => sum + p.totalGainLoss, 0);
  const totalInvested = closedPositions.reduce((sum, p) => sum + p.totalInvested, 0);
  const winningTrades = closedPositions.reduce((sum, p) => sum + p.winningTrades, 0);
  const losingTrades = closedPositions.reduce((sum, p) => sum + p.losingTrades, 0);

  let holdingDaysWeighted = 0;
  let soldQuantity = 0;
  for (const position of portfolio.positions.values()) {
    holdingDaysWeighted += position.holdingDaysWeighted;
    soldQuantity += position.soldQuantity;
  }

  const metrics = {
    totalTrades,
    totalGainLoss,
    totalInvested,
    globalROI: totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0,
    avgGainPerTrade: totalTrades > 0 ? totalGainLoss / totalTrades : 0,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    winningTrades,
    losingTrades,
    totalTickers: closedPositions.length,
    avgHoldingDays: soldQuantity > 0 ? Math.floor(holdingDaysWeighted / soldQuantity) : 0,
  };

  return { closedPositions, progression, metrics };
}

/**
 * Cantidad neta en cartera por ticker (compras menos ventas), sin valorar.
 * @param {Array} transactions
 * @param {(ticker:string)=>boolean} [filter]
 * @returns {Record<string, number>}
 */
export function buildHoldings(transactions = [], filter = () => true) {
  const holdings = {};

  for (const tx of transactions) {
    if (!filter(tx.assetTicker)) continue;

    const quantity = Number(tx.quantity) || 0;
    if (!(tx.assetTicker in holdings)) holdings[tx.assetTicker] = 0;

    if (tx.type === 'BUY') holdings[tx.assetTicker] += quantity;
    else if (tx.type === 'SELL') holdings[tx.assetTicker] -= quantity;
  }

  return holdings;
}

/**
 * Submuestrea una serie ordenada ascendentemente conservando siempre el primer y último punto.
 * @param {Array} items - ordenados ascendentemente
 * @param {{ sampleEvery?: number, maxItems?: number, keyOf?: (item:any)=>number }} options
 */
export function sampleSeries(
  items,
  { sampleEvery = 1, maxItems = 0, keyOf = (item) => toTime(item.date) } = {}
) {
  let result = items;

  if (sampleEvery > 1 && result.length > 2) {
    const length = result.length;
    result = result.filter((_, index) => index === 0 || index === length - 1 || index % sampleEvery === 0);
  }

  if (maxItems > 0 && result.length > maxItems) {
    if (maxItems === 1) {
      return [result[result.length - 1]];
    }

    const keep = [result[0]];
    const step = (result.length - 1) / (maxItems - 1);

    for (let i = 1; i < maxItems - 1; i += 1) {
      keep.push(result[Math.round(i * step)]);
    }

    keep.push(result[result.length - 1]);
    result = keep.filter((item, index, arr) => index === 0 || keyOf(item) !== keyOf(arr[index - 1]));
  }

  return result;
}
