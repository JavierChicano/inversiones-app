/**
 * Motor de cálculo del módulo "Apalancar" (CFD / margen).
 *
 * Todas las funciones son puras y reciben importes en USD. Las fórmulas siguen la
 * especificación del módulo:
 *
 *   Exposición      = G × multiplicador
 *   Cantidad        = Exposición / P_entrada
 *   P&L bruto       = (P_cierre − P_entrada) × Cantidad   (largo)
 *                   = (P_entrada − P_cierre) × Cantidad   (corto)
 *   Comisiones      = C_apertura + C_cierre + S_diario × días
 *   P&L neto        = P&L bruto − Comisiones
 *   ROI neto (%)    = P&L neto / G × 100
 *   P_liquidación   = P_entrada ∓ (0,50 × G / Cantidad)   (largo: −, corto: +)
 *
 * El mismo motor alimenta la API, el dashboard y los modales del cliente, así que los
 * tres muestran siempre los mismos números.
 */

export const DIRECTIONS = ['LONG', 'SHORT'];
export const CLOSE_REASONS = ['MANUAL', 'TAKE_PROFIT', 'STOP_LOSS', 'LIQUIDATION'];
export const LEVERAGED_ASSET_TYPES = ['STOCK', 'CRYPTO', 'INDEX', 'FIAT'];
export const POSITION_STATUS = { OPEN: 'OPEN', CLOSED: 'CLOSED' };

/** Nivel de pérdida sobre la garantía al que el bróker liquida la posición (50 %). */
export const LIQUIDATION_LEVEL = 0.5;

export const DIRECTION_LABELS = { LONG: 'Largo', SHORT: 'Corto' };
export const CLOSE_REASON_LABELS = {
  MANUAL: 'Cierre manual',
  TAKE_PROFIT: 'Take profit',
  STOP_LOSS: 'Stop loss',
  LIQUIDATION: 'Liquidación / Margin call',
};
export const LEVERAGED_ASSET_TYPE_LABELS = { STOCK: 'Acción', CRYPTO: 'Crypto', INDEX: 'Índice', FIAT: 'Forex' };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, decimals = 8) {
  const factor = 10 ** decimals;
  return Math.round((num(value) + Number.EPSILON) * factor) / factor;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Exposición total = garantía × multiplicador */
export function calculateExposure(margin, leverage) {
  return num(margin) * num(leverage);
}

/** Cantidad de unidades = exposición / precio de entrada (0 si el precio no es válido) */
export function calculateQuantity(exposure, entryPrice) {
  const price = num(entryPrice);
  return price > 0 ? num(exposure) / price : 0;
}

/**
 * P&L bruto según la dirección.
 * @param {{ direction: 'LONG'|'SHORT', entryPrice: number, quantity: number }} position
 * @param {number} closePrice
 */
export function calculateGrossPnl(position, closePrice) {
  const entry = num(position?.entryPrice);
  const exit = num(closePrice);
  const quantity = num(position?.quantity);
  const diff = position?.direction === 'SHORT' ? entry - exit : exit - entry;
  return diff * quantity;
}

/**
 * Precio al que las pérdidas alcanzan `level` (por defecto 50 %) de la garantía.
 * @param {{ direction: 'LONG'|'SHORT', entryPrice: number, margin: number, quantity: number }} position
 * @param {number} [level]
 * @returns {number} 0 si la cantidad no es válida
 */
export function calculateLiquidationPrice(position, level = LIQUIDATION_LEVEL) {
  const quantity = num(position?.quantity);
  if (quantity <= 0) return 0;

  const lossPerUnit = (num(level) * num(position?.margin)) / quantity;
  const entry = num(position?.entryPrice);

  if (position?.direction === 'SHORT') return entry + lossPerUnit;
  return Math.max(0, entry - lossPerUnit);
}

/**
 * Días (noches) que la posición ha permanecido abierta: número de cambios de día UTC
 * entre apertura y cierre. Así una posición abierta hoy y cerrada hoy no paga swap, y una
 * abierta a las 23:00 y cerrada a las 01:00 paga una noche.
 */
export function calculateDaysHeld(openedAt, closedAt = new Date()) {
  const start = toDate(openedAt);
  const end = toDate(closedAt) || new Date();
  if (!start) return 0;

  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.round((endDay - startDay) / MS_PER_DAY));
}

/** Comisiones totales = apertura + cierre + swap diario × días */
export function calculateTotalFees({ openFee = 0, closeFee = 0, dailySwap = 0 } = {}, days = 0) {
  return num(openFee) + num(closeFee) + num(dailySwap) * Math.max(0, num(days));
}

/** ROI neto en % sobre la garantía (0 si la garantía no es válida) */
export function calculateRoi(netPnl, margin) {
  const base = num(margin);
  return base > 0 ? (num(netPnl) / base) * 100 : 0;
}

/**
 * Proximidad al precio de liquidación, de 0 % (en el precio de entrada o en beneficio)
 * a 100 % (precio de liquidación alcanzado). Es el porcentaje del recorrido adverso
 * entre entrada y liquidación que el precio ya ha consumido.
 * @returns {number|null} null si no hay precio actual
 */
export function calculateLiquidationProximity(position, currentPrice) {
  const price = num(currentPrice);
  if (price <= 0) return null;

  const entry = num(position?.entryPrice);
  const liquidation = calculateLiquidationPrice(position);
  const totalDistance = Math.abs(entry - liquidation);
  if (totalDistance <= 0) return null;

  const adverseMove = position?.direction === 'SHORT' ? price - entry : entry - price;
  return Math.min(100, Math.max(0, (adverseMove / totalDistance) * 100));
}

/**
 * Valora una posición abierta a precio actual: P&L latente, swap devengado, riesgo.
 * @param {object} position fila de leveraged_positions
 * @param {{ currentPrice?: number, now?: Date }} options
 */
export function evaluateOpenPosition(position, { currentPrice = 0, now = new Date() } = {}) {
  const price = num(currentPrice);
  const hasPrice = price > 0;
  const daysHeld = calculateDaysHeld(position.openedAt, now);
  const swapAccrued = num(position.dailySwap) * daysHeld;
  const feesAccrued = calculateTotalFees({ openFee: position.openFee, dailySwap: position.dailySwap }, daysHeld);
  const grossPnl = hasPrice ? calculateGrossPnl(position, price) : 0;
  const netPnl = hasPrice ? grossPnl - feesAccrued : -feesAccrued;
  const liquidationPrice = calculateLiquidationPrice(position);
  const entry = num(position.entryPrice);

  return {
    currentPrice: price,
    hasPrice,
    daysHeld,
    swapAccrued,
    feesAccrued,
    grossPnl,
    netPnl,
    roi: calculateRoi(netPnl, position.margin),
    priceChangePercent: hasPrice && entry > 0 ? ((price - entry) / entry) * 100 : 0,
    liquidationPrice,
    liquidationProximity: calculateLiquidationProximity(position, price),
    distanceToLiquidationPercent: hasPrice && price > 0 ? (Math.abs(price - liquidationPrice) / price) * 100 : null,
    equity: num(position.margin) + netPnl,
  };
}

/**
 * Calcula todos los valores de cierre de una posición. No toca la base de datos.
 *
 * En una liquidación (margin call) la pérdida bruta se fija en el 50 % de la garantía
 * y el precio de cierre, si no se indica, es el precio de liquidación estimado.
 *
 * @param {object} position fila de leveraged_positions
 * @param {{ closePrice?: number, closeFee?: number, closedAt?: Date, reason?: string }} closeData
 */
export function settleLeveragedPosition(position, { closePrice, closeFee = 0, closedAt = new Date(), reason = 'MANUAL' } = {}) {
  const closeReason = CLOSE_REASONS.includes(reason) ? reason : 'MANUAL';
  const isLiquidation = closeReason === 'LIQUIDATION';
  const closeDate = toDate(closedAt) || new Date();
  const liquidationPrice = calculateLiquidationPrice(position);

  const finalClosePrice = isLiquidation && !(num(closePrice) > 0) ? liquidationPrice : num(closePrice);
  const daysHeld = calculateDaysHeld(position.openedAt, closeDate);
  const swapTotal = num(position.dailySwap) * daysHeld;
  const totalFees = calculateTotalFees({ openFee: position.openFee, closeFee, dailySwap: position.dailySwap }, daysHeld);
  const grossPnl = isLiquidation ? -(LIQUIDATION_LEVEL * num(position.margin)) : calculateGrossPnl(position, finalClosePrice);
  const netPnl = grossPnl - totalFees;

  return {
    status: POSITION_STATUS.CLOSED,
    closedAt: closeDate,
    closePrice: round(finalClosePrice),
    closeFee: round(num(closeFee)),
    closeReason,
    daysHeld,
    swapTotal: round(swapTotal),
    totalFees: round(totalFees),
    grossPnl: round(grossPnl),
    netPnl: round(netPnl),
    roi: round(calculateRoi(netPnl, position.margin), 6),
  };
}

/**
 * Resumen agregado para las tarjetas del dashboard.
 * @param {Array<object & { evaluation: object }>} openPositions posiciones abiertas ya valoradas
 * @param {Array<object>} closedPositions posiciones cerradas (con netPnl, grossPnl, totalFees...)
 */
export function summarizeLeveragedPositions(openPositions = [], closedPositions = []) {
  const summary = {
    openCount: openPositions.length,
    closedCount: closedPositions.length,
    marginInvested: 0,
    totalExposure: 0,
    unrealizedGrossPnl: 0,
    unrealizedNetPnl: 0,
    swapAccrued: 0,
    realizedGrossPnl: 0,
    realizedNetPnl: 0,
    realizedFees: 0,
    winningClosed: 0,
    liquidations: 0,
    maxLiquidationProximity: 0,
    positionsAtRisk: 0,
  };

  for (const position of openPositions) {
    const evaluation = position.evaluation || {};
    summary.marginInvested += num(position.margin);
    summary.totalExposure += num(position.exposure);
    summary.unrealizedGrossPnl += num(evaluation.grossPnl);
    summary.unrealizedNetPnl += num(evaluation.netPnl);
    summary.swapAccrued += num(evaluation.swapAccrued);
    const proximity = num(evaluation.liquidationProximity);
    summary.maxLiquidationProximity = Math.max(summary.maxLiquidationProximity, proximity);
    if (proximity >= 75) summary.positionsAtRisk += 1;
  }

  for (const position of closedPositions) {
    summary.realizedGrossPnl += num(position.grossPnl);
    summary.realizedNetPnl += num(position.netPnl);
    summary.realizedFees += num(position.totalFees);
    if (num(position.netPnl) > 0) summary.winningClosed += 1;
    if (position.closeReason === 'LIQUIDATION') summary.liquidations += 1;
  }

  summary.unrealizedRoi = calculateRoi(summary.unrealizedNetPnl, summary.marginInvested);
  summary.winRate = summary.closedCount > 0 ? (summary.winningClosed / summary.closedCount) * 100 : 0;

  return summary;
}

/**
 * Enriquece filas de leveraged_positions con datos del asset y, en las abiertas, la valoración
 * a precio actual. Lo comparten /api/leverage y /api/dashboard/stats.
 * @param {Array<object>} positions
 * @param {Map<string, {name?:string,type?:string,currentPrice?:number}>} assetMap
 * @param {Date} [now]
 */
export function enrichLeveragedPositions(positions = [], assetMap = new Map(), now = new Date()) {
  const openPositions = [];
  const closedPositions = [];

  for (const position of positions) {
    const asset = assetMap.get(position.assetTicker);
    const base = {
      ...position,
      assetName: asset?.name || position.assetTicker,
      assetType: asset?.type || 'STOCK',
      currentPrice: num(asset?.currentPrice),
      liquidationPrice: calculateLiquidationPrice(position),
      openedAt: new Date(position.openedAt).toISOString(),
      closedAt: position.closedAt ? new Date(position.closedAt).toISOString() : null,
    };

    if (position.status === POSITION_STATUS.CLOSED) {
      closedPositions.push(base);
    } else {
      openPositions.push({ ...base, evaluation: evaluateOpenPosition(position, { currentPrice: base.currentPrice, now }) });
    }
  }

  return { openPositions, closedPositions };
}

/**
 * Integra los cierres apalancados en el análisis de posiciones cerradas del motor de cartera
 * (`summarizeClosedPositions`). Cada cierre es una operación: invertido = garantía,
 * resultado = P&L neto, "vendido" = garantía + P&L neto. Los cierres se funden en la fila del
 * mismo ticker (totales conjuntos); cada operación lleva `leveraged: true` para distinguirla en
 * el desglose, y la fila expone `leveragedTrades` con cuántas son.
 *
 * Todo en USD; la ruta convierte a EUR después.
 * @param {{ closedPositions: Array, progression: Array, metrics: object }} analysis
 * @param {Array<object>} closedLeveraged posiciones cerradas (de enrichLeveragedPositions)
 */
export function mergeLeveragedIntoClosedAnalysis(analysis, closedLeveraged = []) {
  const time = (value) => (value ? new Date(value).getTime() : 0);
  const groups = new Map();

  for (const position of closedLeveraged) {
    const margin = num(position.margin);
    const netPnl = num(position.netPnl);
    const trade = {
      date: position.closedAt,
      openedAt: position.openedAt,
      quantity: num(position.quantity),
      revenue: margin + netPnl,
      invested: margin,
      gainLoss: netPnl,
      grossPnl: num(position.grossPnl),
      totalFees: num(position.totalFees),
      roi: calculateRoi(netPnl, margin),
      holdingDays: num(position.daysHeld),
      leveraged: true,
      direction: position.direction,
      leverage: num(position.leverage),
      closeReason: position.closeReason,
    };

    if (!groups.has(position.assetTicker)) {
      groups.set(position.assetTicker, { ticker: position.assetTicker, assetType: position.assetType || 'STOCK', trades: [] });
    }
    groups.get(position.assetTicker).trades.push(trade);
  }

  // Fila por ticker: contado + CFD en los mismos totales
  const byTicker = new Map();
  for (const position of analysis.closedPositions || []) {
    byTicker.set(position.ticker, {
      ...position,
      trades: (position.trades || []).map((trade) => ({ ...trade, leveraged: false })),
      leveragedTrades: 0,
    });
  }

  for (const group of groups.values()) {
    const leveragedTrades = group.trades;
    const leveragedGainLoss = leveragedTrades.reduce((sum, trade) => sum + trade.gainLoss, 0);
    const leveragedInvested = leveragedTrades.reduce((sum, trade) => sum + trade.invested, 0);
    const leveragedWinning = leveragedTrades.filter((trade) => trade.gainLoss > 0).length;
    const leveragedLosing = leveragedTrades.filter((trade) => trade.gainLoss < 0).length;
    const leveragedDays = leveragedTrades.reduce((sum, trade) => sum + trade.holdingDays, 0);

    const existing = byTicker.get(group.ticker);
    const spotTrades = num(existing?.totalTrades);
    const totalTrades = spotTrades + leveragedTrades.length;
    const totalGainLoss = num(existing?.totalGainLoss) + leveragedGainLoss;
    const totalInvested = num(existing?.totalInvested) + leveragedInvested;
    const winningTrades = num(existing?.winningTrades) + leveragedWinning;
    const losingTrades = num(existing?.losingTrades) + leveragedLosing;

    byTicker.set(group.ticker, {
      ...(existing || { ticker: group.ticker, type: group.assetType, buyCount: 0 }),
      trades: [...(existing?.trades || []), ...leveragedTrades].sort((a, b) => time(b.date) - time(a.date)),
      leveragedTrades: leveragedTrades.length,
      totalGainLoss,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      avgGainPerTrade: totalTrades > 0 ? totalGainLoss / totalTrades : 0,
      roi: calculateRoi(totalGainLoss, totalInvested),
      totalInvested,
      totalRevenue: num(existing?.totalRevenue) + leveragedInvested + leveragedGainLoss,
      avgHoldingDays:
        totalTrades > 0 ? Math.floor((num(existing?.avgHoldingDays) * spotTrades + leveragedDays) / totalTrades) : 0,
    });
  }

  const closedPositions = [...byTicker.values()].sort((a, b) => b.totalGainLoss - a.totalGainLoss);

  // Progresión conjunta ordenada por fecha, con acumulado recalculado
  let cumulativeGain = 0;
  const progression = [
    ...(analysis.progression || []).map((item) => ({ ...item, leveraged: false })),
    ...closedLeveraged.map((position) => ({ date: position.closedAt, ticker: position.assetTicker, gainLoss: num(position.netPnl), leveraged: true })),
  ]
    .sort((a, b) => time(a.date) - time(b.date))
    .map((item) => {
      cumulativeGain += num(item.gainLoss);
      return { ...item, cumulativeGain };
    });

  const spot = analysis.metrics || {};
  const leveragedTrades = closedLeveraged.length;
  const leveragedGainLoss = closedLeveraged.reduce((sum, position) => sum + num(position.netPnl), 0);
  const leveragedInvested = closedLeveraged.reduce((sum, position) => sum + num(position.margin), 0);
  const leveragedWinning = closedLeveraged.filter((position) => num(position.netPnl) > 0).length;
  const leveragedLosing = closedLeveraged.filter((position) => num(position.netPnl) < 0).length;
  const leveragedHoldingDays = closedLeveraged.reduce((sum, position) => sum + num(position.daysHeld), 0);
  // Duración real apertura → cierre en minutos: en CFD las operaciones duran horas o minutos
  const leveragedHoldingMinutes = closedLeveraged.reduce((sum, position) => {
    const opened = time(position.openedAt);
    const closed = time(position.closedAt);
    return sum + (opened > 0 && closed > opened ? (closed - opened) / 60000 : 0);
  }, 0);

  const totalTrades = num(spot.totalTrades) + leveragedTrades;
  const totalGainLoss = num(spot.totalGainLoss) + leveragedGainLoss;
  const totalInvested = num(spot.totalInvested) + leveragedInvested;
  const winningTrades = num(spot.winningTrades) + leveragedWinning;
  const losingTrades = num(spot.losingTrades) + leveragedLosing;

  const metrics = {
    ...spot,
    totalTrades,
    totalGainLoss,
    totalInvested,
    globalROI: totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0,
    avgGainPerTrade: totalTrades > 0 ? totalGainLoss / totalTrades : 0,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    winningTrades,
    losingTrades,
    totalTickers: closedPositions.length,
    avgHoldingDays:
      totalTrades > 0
        ? Math.floor((num(spot.avgHoldingDays) * num(spot.totalTrades) + leveragedHoldingDays) / totalTrades)
        : 0,
    // Desglose por segmento para las tarjetas del análisis (ganancia, ROI, win rate y tiempo por separado)
    spot: {
      totalTrades: num(spot.totalTrades),
      totalGainLoss: num(spot.totalGainLoss),
      totalInvested: num(spot.totalInvested),
      globalROI: num(spot.globalROI),
      avgGainPerTrade: num(spot.avgGainPerTrade),
      winRate: num(spot.winRate),
      winningTrades: num(spot.winningTrades),
      losingTrades: num(spot.losingTrades),
      avgHoldingDays: num(spot.avgHoldingDays),
    },
    leverage: {
      totalTrades: leveragedTrades,
      totalGainLoss: leveragedGainLoss,
      totalInvested: leveragedInvested,
      globalROI: calculateRoi(leveragedGainLoss, leveragedInvested),
      avgGainPerTrade: leveragedTrades > 0 ? leveragedGainLoss / leveragedTrades : 0,
      winningTrades: leveragedWinning,
      losingTrades: leveragedLosing,
      winRate: leveragedTrades > 0 ? (leveragedWinning / leveragedTrades) * 100 : 0,
      avgHoldingDays: leveragedTrades > 0 ? Math.floor(leveragedHoldingDays / leveragedTrades) : 0,
      avgHoldingMinutes: leveragedTrades > 0 ? Math.floor(leveragedHoldingMinutes / leveragedTrades) : 0,
      liquidations: closedLeveraged.filter((position) => position.closeReason === 'LIQUIDATION').length,
    },
  };

  return { closedPositions, progression, metrics };
}
