const DATE_FALLBACK = 0;

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

    if (exchange.fromCurrency === "EUR") {
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
        mode: "open",
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
      const fallbackCostEur = rate > 0 ? remainingUsdToMatch / rate : 0;
      costBasisEur += fallbackCostEur;
      remainingUsdToMatch = 0;
    }

    const proceedsEur = soldUsd * rate;
    const differenceEur = proceedsEur - costBasisEur;
    const percentage = costBasisEur > 0 ? (differenceEur / costBasisEur) * 100 : 0;

    recoveredEur += proceedsEur;
    realizedNetEur += differenceEur;

    byId.set(exchange.id, {
      mode: "closed",
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