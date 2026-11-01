/**
 * Cálculos puros sobre cambios de divisa EUR⇄USD.
 *
 * Convención: `exchangeRate` siempre es "unidades de `toCurrency` por 1 unidad de `fromCurrency`".
 *  - EUR→USD: USD por 1 EUR (ej. 1.09)
 *  - USD→EUR: EUR por 1 USD (ej. 0.92)
 */

const DATE_FALLBACK = 0;

export const SUPPORTED_CURRENCIES = ['EUR', 'USD'];
export const DEFAULT_EUR_USD_RATE = 1.08;

function toTimestamp(value) {
  if (!value) return DATE_FALLBACK;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : DATE_FALLBACK;
}

function sortExchangesByDate(exchanges) {
  return [...exchanges].sort((left, right) => {
    const dateDiff = toTimestamp(left.date) - toTimestamp(right.date);
    if (dateDiff !== 0) return dateDiff;

    const createdAtDiff = toTimestamp(left.createdAt) - toTimestamp(right.createdAt);
    if (createdAtDiff !== 0) return createdAtDiff;

    return (left.id || 0) - (right.id || 0);
  });
}

function formatNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Métricas FIFO: cada cambio USD→EUR cierra (parcialmente) los lotes EUR→USD más antiguos.
 * @param {Array} exchanges
 * @param {number} currentRateEurUsd - USD por 1 EUR actual
 */
export function calculateCurrencyExchangeMetrics(exchanges = [], currentRateEurUsd = 0) {
  const orderedExchanges = sortExchangesByDate(exchanges);
  const openLots = [];
  const byId = new Map();

  let investedEur = 0;
  let recoveredEur = 0;
  let realizedNetEur = 0;

  orderedExchanges.forEach((exchange) => {
    const amount = formatNumber(Number(exchange.amount));
    const rate = formatNumber(Number(exchange.exchangeRate));

    if (exchange.fromCurrency === 'EUR') {
      const usdAmount = amount * rate;
      const basisEur = amount;
      const currentValueEur = currentRateEurUsd > 0 ? usdAmount / currentRateEurUsd : basisEur;
      const differenceEur = currentValueEur - basisEur;
      const percentage = basisEur > 0 ? (differenceEur / basisEur) * 100 : 0;

      investedEur += basisEur;
      openLots.push({
        exchangeId: exchange.id,
        remainingUsd: usdAmount,
        remainingCostEur: basisEur,
      });

      byId.set(exchange.id, {
        mode: 'open',
        basisEur,
        currentValueEur,
        differenceEur,
        percentage,
      });
      return;
    }

    const soldUsd = amount;
    let remainingUsdToMatch = soldUsd;
    let costBasisEur = 0;

    while (remainingUsdToMatch > 0 && openLots.length > 0) {
      const lot = openLots[0];
      const matchedUsd = Math.min(remainingUsdToMatch, lot.remainingUsd);
      const matchedCostEur = lot.remainingUsd > 0 ? (lot.remainingCostEur * matchedUsd) / lot.remainingUsd : 0;

      lot.remainingUsd -= matchedUsd;
      lot.remainingCostEur -= matchedCostEur;
      remainingUsdToMatch -= matchedUsd;
      costBasisEur += matchedCostEur;

      if (lot.remainingUsd <= 1e-12) {
        openLots.shift();
      }
    }

    if (remainingUsdToMatch > 1e-12) {
      // USD vendidos sin lote de origen registrado: se valoran al tipo de la propia operación
      // (rate = EUR por 1 USD), de modo que no generan ganancia ni pérdida artificial.
      const fallbackCostEur = rate > 0 ? remainingUsdToMatch * rate : 0;
      costBasisEur += fallbackCostEur;
      remainingUsdToMatch = 0;
    }

    const proceedsEur = soldUsd * rate;
    const differenceEur = proceedsEur - costBasisEur;
    const percentage = costBasisEur > 0 ? (differenceEur / costBasisEur) * 100 : 0;

    recoveredEur += proceedsEur;
    realizedNetEur += differenceEur;

    byId.set(exchange.id, {
      mode: 'closed',
      basisEur: costBasisEur,
      currentValueEur: proceedsEur,
      proceedsEur,
      differenceEur,
      percentage,
    });
  });

  const openCostEur = openLots.reduce((sum, lot) => sum + lot.remainingCostEur, 0);
  const openCurrentValueEur = openLots.reduce((sum, lot) => {
    return sum + (currentRateEurUsd > 0 ? lot.remainingUsd / currentRateEurUsd : lot.remainingCostEur);
  }, 0);
  const openUnrealizedEur = openCurrentValueEur - openCostEur;
  const totalNetEur = openUnrealizedEur + realizedNetEur;
  const recoveryRate = investedEur > 0 ? (recoveredEur / investedEur) * 100 : 0;

  return {
    byId,
    summary: {
      investedEur,
      recoveredEur,
      openCostEur,
      openCurrentValueEur,
      openUnrealizedEur,
      realizedNetEur,
      totalNetEur,
      recoveryRate,
      openCount: openLots.length,
    },
  };
}

/**
 * Resumen de volúmenes por sentido del cambio.
 * @param {Array} exchanges
 */
export function summarizeExchanges(exchanges = []) {
  let totalEurToUsd = 0;
  let totalUsdToEur = 0;
  let amountEurConverted = 0;
  let amountUsdConverted = 0;
  let eurToUsdCount = 0;
  let usdToEurCount = 0;

  for (const exchange of exchanges) {
    const amount = formatNumber(Number(exchange.amount));
    const rate = formatNumber(Number(exchange.exchangeRate));

    if (exchange.fromCurrency === 'EUR') {
      eurToUsdCount += 1;
      if (exchange.toCurrency === 'USD') {
        totalEurToUsd += amount * rate;
        amountEurConverted += amount;
      }
    } else if (exchange.fromCurrency === 'USD') {
      usdToEurCount += 1;
      if (exchange.toCurrency === 'EUR') {
        totalUsdToEur += amount * rate;
        amountUsdConverted += amount;
      }
    }
  }

  return {
    totalExchanges: exchanges.length,
    eurToUsd: {
      count: eurToUsdCount,
      totalAmountEur: amountEurConverted,
      totalAmountUsd: totalEurToUsd,
    },
    usdToEur: {
      count: usdToEurCount,
      totalAmountUsd: amountUsdConverted,
      totalAmountEur: totalUsdToEur,
    },
  };
}

/**
 * Ganancia/pérdida de un cambio individual frente al tipo actual (en EUR).
 *  - EUR→USD: posición ABIERTA (especulativa): qué valen hoy en EUR los USD obtenidos.
 *  - USD→EUR: posición REALIZADA: EUR obtenidos frente a los que daría el tipo actual.
 *
 * @param {number} originalAmount - Cantidad de `fromCurrency` cambiada
 * @param {number} originalRate - `toCurrency` por 1 `fromCurrency` en el momento del cambio
 * @param {number} currentRate - `toCurrency` por 1 `fromCurrency` actual (misma convención)
 * @param {'EUR'|'USD'} fromCurrency
 */
export function calculateExchangeProfitLoss(originalAmount, originalRate, currentRate, fromCurrency) {
  const amount = formatNumber(Number(originalAmount));
  const rate = formatNumber(Number(originalRate));
  const current = formatNumber(Number(currentRate));

  if (fromCurrency === 'EUR') {
    const usdAmount = amount * rate;
    const currentEur = current > 0 ? usdAmount / current : amount;
    const difference = currentEur - amount;
    const percentage = amount > 0 ? (difference / amount) * 100 : 0;

    return {
      originalValue: usdAmount,
      currentValue: usdAmount,
      difference,
      percentage,
      isProfit: difference > 0,
      isRealized: false,
      type: 'EUR→USD',
    };
  }

  const eurAmount = amount * rate;
  const equivalentEurAtCurrentRate = amount * current;
  const difference = eurAmount - equivalentEurAtCurrentRate;
  const percentage = equivalentEurAtCurrentRate > 0 ? (difference / equivalentEurAtCurrentRate) * 100 : 0;

  return {
    originalValue: eurAmount,
    currentValue: eurAmount,
    difference,
    percentage,
    isProfit: difference > 0,
    isRealized: true,
    type: 'USD→EUR',
  };
}

/**
 * Tipo de cambio al que se alcanzaría un objetivo de ganancia al deshacer la operación.
 * En la convención "toCurrency por 1 fromCurrency", ganar al cerrar implica que el tipo baje.
 * @param {number} originalRate
 * @param {number} [targetPercentage]
 */
export function calculateTargetRate(originalRate, targetPercentage = 5) {
  return formatNumber(Number(originalRate)) / (1 + targetPercentage / 100);
}

/**
 * Enriquecer un cambio con tipo actual, P&L y objetivos.
 * @param {object} exchange
 * @param {number} currentRateEurUsd - USD por 1 EUR actual
 */
export function enrichExchange(exchange, currentRateEurUsd) {
  const safeRate = currentRateEurUsd > 0 ? currentRateEurUsd : DEFAULT_EUR_USD_RATE;
  const currentRate = exchange.fromCurrency === 'EUR' ? safeRate : 1 / safeRate;
  const profitLoss = calculateExchangeProfitLoss(
    exchange.amount,
    exchange.exchangeRate,
    currentRate,
    exchange.fromCurrency
  );

  return {
    ...exchange,
    currentRate,
    ...profitLoss,
    breakEvenRate: exchange.exchangeRate,
    goodTargetRate: calculateTargetRate(exchange.exchangeRate, 5),
    excellentTargetRate: calculateTargetRate(exchange.exchangeRate, 10),
  };
}
