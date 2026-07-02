/**
 * Calcula proyecciones de staking a partir de cantidad, APY y precio actual.
 * El APY se recibe en porcentaje (por ejemplo, 8.5 para 8.5%).
 */
export function calculateStakingProjection(amountStaked, manualApy, currentPrice = 0) {
  const safeAmount = Number(amountStaked) || 0;
  const safeApy = Number(manualApy) || 0;
  const safePrice = Number(currentPrice) || 0;

  const annualCoin = safeAmount * (safeApy / 100);
  const monthlyCoin = annualCoin / 12;
  const dailyCoin = annualCoin / 365;

  const annualUsd = annualCoin * safePrice;
  const monthlyUsd = monthlyCoin * safePrice;
  const dailyUsd = dailyCoin * safePrice;

  return {
    daily: {
      coin: dailyCoin,
      usd: dailyUsd,
    },
    monthly: {
      coin: monthlyCoin,
      usd: monthlyUsd,
    },
    annual: {
      coin: annualCoin,
      usd: annualUsd,
    },
  };
}

export function calculateAccruedStakingReward(amountStaked, manualApy, fromDate, toDate = new Date()) {
  const safeAmount = Number(amountStaked) || 0;
  const safeApy = Number(manualApy) || 0;
  const start = fromDate ? new Date(fromDate) : null;
  const end = toDate ? new Date(toDate) : new Date();

  if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || safeAmount <= 0 || safeApy < 0) {
    return {
      coin: 0,
      days: 0,
      periodStart: start,
      periodEnd: end,
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(0, (end.getTime() - start.getTime()) / msPerDay);
  const coin = safeAmount * (safeApy / 100) * (days / 365);

  return {
    coin,
    days: Math.floor(days),
    periodStart: start,
    periodEnd: end,
  };
}

export function getStakingSummary({ totalCryptoOwned = 0, totalStaked = 0 }) {
  const safeOwned = Number(totalCryptoOwned) || 0;
  const safeStaked = Number(totalStaked) || 0;

  const stakedPercentage = safeOwned > 0 ? (safeStaked / safeOwned) * 100 : 0;

  return {
    totalCryptoOwned: safeOwned,
    totalStaked: safeStaked,
    stakedPercentage,
  };
}
