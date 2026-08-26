import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { CurrencyExchangeRepository } from '@/lib/repository/currencyExchange.repository';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAssetByTicker } from '@/lib/repository/asset.repository';

const DEFAULT_EUR_USD = 1.1;

function toMonthKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
}

function monthKeyToLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
}

function addMonths(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  return toMonthKey(new Date(year, month - 1 + delta, 1));
}

function emptyBucket(key) {
  return { key, inflowEur: 0, outflowEur: 0, netEur: 0, operations: 0 };
}

/**
 * Construye los flujos de aportación en EUR a partir de los cambios de divisa.
 * EUR→USD = dinero que sale del bolsillo hacia la inversión.
 * USD→EUR = dinero que vuelve al bolsillo.
 */
function flowsFromExchanges(exchanges) {
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
 * Alternativa cuando el usuario no registra cambios de divisa: se aproxima la aportación
 * con el flujo neto de compras menos ventas (en USD, convertido con el tipo actual).
 */
function flowsFromTransactions(transactions, eurUsdRate) {
  const usdToEur = 1 / eurUsdRate;

  return transactions.map((tx) => {
    const gross = tx.quantity * tx.pricePerUnit;
    const fees = tx.fees || 0;
    const usd = tx.type === 'BUY' ? gross + fees : -(gross - fees);

    return {
      date: tx.date,
      eur: usd * usdToEur,
    };
  });
}

function emptyMetrics() {
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
 * GET /api/profile/contributions
 * Disciplina de aportación: serie mensual de aportaciones netas en EUR y métricas asociadas.
 */
export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = decoded.userId;
    const exchanges = await CurrencyExchangeRepository.getByUserId(userId);

    let source = 'exchanges';
    let flows = flowsFromExchanges(exchanges);

    if (flows.length === 0) {
      const eurUsdAsset = await findAssetByTicker('EURUSD');
      const eurUsdRate = eurUsdAsset?.currentPrice || DEFAULT_EUR_USD;
      const transactions = await findAllUserTransactions(userId);

      source = 'transactions';
      flows = flowsFromTransactions(transactions, eurUsdRate);
    }

    const validFlows = flows.filter(
      (flow) => flow.date && !Number.isNaN(new Date(flow.date).getTime())
    );

    if (validFlows.length === 0) {
      return NextResponse.json({ source, months: [], metrics: emptyMetrics() });
    }

    // Agrupar por mes
    const bucketMap = new Map();
    validFlows.forEach((flow) => {
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
    });

    // Rellenar meses sin movimientos desde el primer mes hasta el mes actual
    const sortedKeys = [...bucketMap.keys()].sort();
    const firstMonth = sortedKeys[0];
    const currentMonth = toMonthKey(new Date());
    const lastRecorded = sortedKeys[sortedKeys.length - 1];
    const lastMonth = lastRecorded > currentMonth ? lastRecorded : currentMonth;

    const months = [];
    for (let key = firstMonth; key <= lastMonth; key = addMonths(key, 1)) {
      const bucket = bucketMap.get(key) || emptyBucket(key);
      months.push({ ...bucket, label: monthKeyToLabel(key) });
    }

    // Métricas
    const monthsTotal = months.length;
    const monthsWithContribution = months.filter((m) => m.inflowEur > 0).length;
    const totalContributedEur = months.reduce((sum, m) => sum + m.inflowEur, 0);
    const totalWithdrawnEur = months.reduce((sum, m) => sum + m.outflowEur, 0);
    const netContributedEur = totalContributedEur - totalWithdrawnEur;

    let longestStreak = 0;
    let running = 0;
    months.forEach((m) => {
      running = m.inflowEur > 0 ? running + 1 : 0;
      longestStreak = Math.max(longestStreak, running);
    });

    // Racha actual: se cuenta hacia atrás; si el mes en curso aún no tiene aportación no rompe la racha
    let currentStreak = 0;
    let index = months.length - 1;
    if (index >= 0 && months[index].key === currentMonth && months[index].inflowEur <= 0) {
      index -= 1;
    }
    while (index >= 0 && months[index].inflowEur > 0) {
      currentStreak += 1;
      index -= 1;
    }

    const bestMonth = months.reduce(
      (best, m) => (!best || m.inflowEur > best.inflowEur ? m : best),
      null
    );

    return NextResponse.json({
      source,
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
    });
  } catch (error) {
    console.error('Error en GET /api/profile/contributions:', error);
    return NextResponse.json(
      { error: 'Error al calcular la disciplina de aportación' },
      { status: 500 }
    );
  }
}
