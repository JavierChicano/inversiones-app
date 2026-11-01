/**
 * Disciplina de aportación: serie mensual de aportaciones netas en EUR y métricas asociadas.
 */

export function toMonthKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
}

export function monthKeyToLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
}

export function addMonths(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  return toMonthKey(new Date(year, month - 1 + delta, 1));
}

function emptyBucket(key) {
  return { key, inflowEur: 0, outflowEur: 0, netEur: 0, operations: 0 };
}

/**
 * Flujos de aportación en EUR a partir de los cambios de divisa.
 * EUR→USD = dinero que sale del bolsillo hacia la inversión; USD→EUR = dinero que vuelve.
 */
export function flowsFromExchanges(exchanges = []) {
  return exchanges.map((exchange) => {
    const amount = Number(exchange.amount) || 0;
    const rate = Number(exchange.exchangeRate) || 0;
    const isInflow = exchange.fromCurrency === 'EUR';

    return {
      date: exchange.date,
      eur: isInflow ? amount : -(amount * rate),
    };
  });
}

/**
 * Alternativa cuando no hay cambios de divisa: compras menos ventas (USD convertido al tipo actual).
 */
export function flowsFromTransactions(transactions = [], eurUsdRate = 1) {
  const usdToEur = eurUsdRate > 0 ? 1 / eurUsdRate : 1;

  return transactions.map((tx) => {
    const gross = (Number(tx.quantity) || 0) * (Number(tx.pricePerUnit) || 0);
    const fees = Number(tx.fees) || 0;
    const usd = tx.type === 'BUY' ? gross + fees : -(gross - fees);

    return {
      date: tx.date,
      eur: usd * usdToEur,
    };
  });
}

export function emptyContributionMetrics() {
  return {
    monthsTotal: 0,
    monthsWithContribution: 0,
    disciplineRate: 0,
    avgMonthlyContribution: 0,
    avgMonthlyNet: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalContributedEur: 0,
    totalWithdrawnEur: 0,
    netContributedEur: 0,
    bestMonth: null,
    firstMonth: null,
    lastMonth: null,
  };
}

/**
 * Agrupa los flujos por mes (rellenando meses vacíos hasta el mes actual) y calcula métricas.
 * @param {Array<{date:*, eur:number}>} flows
 * @param {Date} [now]
 * @returns {{ months: Array, metrics: object }}
 */
export function buildContributionSeries(flows = [], now = new Date()) {
  const validFlows = flows.filter((flow) => flow.date && !Number.isNaN(new Date(flow.date).getTime()));

  if (validFlows.length === 0) {
    return { months: [], metrics: emptyContributionMetrics() };
  }

  const bucketMap = new Map();
  for (const flow of validFlows) {
    const key = toMonthKey(flow.date);
    if (!bucketMap.has(key)) {
      bucketMap.set(key, emptyBucket(key));
    }
    const bucket = bucketMap.get(key);
    if (flow.eur >= 0) {
      bucket.inflowEur += flow.eur;
    } else {
      bucket.outflowEur += -flow.eur;
    }
    bucket.netEur += flow.eur;
    bucket.operations += 1;
  }

  const sortedKeys = [...bucketMap.keys()].sort();
  const firstMonth = sortedKeys[0];
  const currentMonth = toMonthKey(now);
  const lastRecorded = sortedKeys[sortedKeys.length - 1];
  const lastMonth = lastRecorded > currentMonth ? lastRecorded : currentMonth;

  const months = [];
  for (let key = firstMonth; key <= lastMonth; key = addMonths(key, 1)) {
    const bucket = bucketMap.get(key) || emptyBucket(key);
    months.push({ ...bucket, label: monthKeyToLabel(key) });
  }

  const monthsTotal = months.length;
  const monthsWithContribution = months.filter((m) => m.inflowEur > 0).length;
  const totalContributedEur = months.reduce((sum, m) => sum + m.inflowEur, 0);
  const totalWithdrawnEur = months.reduce((sum, m) => sum + m.outflowEur, 0);
  const netContributedEur = totalContributedEur - totalWithdrawnEur;

  let longestStreak = 0;
  let running = 0;
  for (const m of months) {
    running = m.inflowEur > 0 ? running + 1 : 0;
    longestStreak = Math.max(longestStreak, running);
  }

  // Racha actual: hacia atrás; el mes en curso sin aportación todavía no rompe la racha
  let currentStreak = 0;
  let index = months.length - 1;
  if (index >= 0 && months[index].key === currentMonth && months[index].inflowEur <= 0) {
    index -= 1;
  }
  while (index >= 0 && months[index].inflowEur > 0) {
    currentStreak += 1;
    index -= 1;
  }

  const bestMonth = months.reduce((best, m) => (!best || m.inflowEur > best.inflowEur ? m : best), null);

  return {
    months,
    metrics: {
      monthsTotal,
      monthsWithContribution,
      disciplineRate: monthsTotal > 0 ? (monthsWithContribution / monthsTotal) * 100 : 0,
      avgMonthlyContribution: monthsTotal > 0 ? totalContributedEur / monthsTotal : 0,
      avgMonthlyNet: monthsTotal > 0 ? netContributedEur / monthsTotal : 0,
      currentStreak,
      longestStreak,
      totalContributedEur,
      totalWithdrawnEur,
      netContributedEur,
      bestMonth:
        bestMonth && bestMonth.inflowEur > 0
          ? { key: bestMonth.key, label: bestMonth.label, inflowEur: bestMonth.inflowEur }
          : null,
      firstMonth,
      lastMonth,
    },
  };
}
