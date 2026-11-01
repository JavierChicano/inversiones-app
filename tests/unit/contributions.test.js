import { describe, expect, test } from 'bun:test';
import {
  addMonths,
  buildContributionSeries,
  emptyContributionMetrics,
  flowsFromExchanges,
  flowsFromTransactions,
  toMonthKey,
} from '@/lib/utils/contributions';

describe('helpers de mes', () => {
  test('toMonthKey y addMonths', () => {
    expect(toMonthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(addMonths('2026-01', 1)).toBe('2026-02');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('flows', () => {
  test('flowsFromExchanges: EUR→USD entra, USD→EUR sale convertido a EUR', () => {
    const flows = flowsFromExchanges([
      { fromCurrency: 'EUR', amount: 500, exchangeRate: 1.1, date: '2026-01-05' },
      { fromCurrency: 'USD', amount: 200, exchangeRate: 0.9, date: '2026-02-05' },
    ]);
    expect(flows).toEqual([
      { date: '2026-01-05', eur: 500 },
      { date: '2026-02-05', eur: -180 },
    ]);
  });

  test('flowsFromTransactions: compras menos ventas convertidas al tipo actual', () => {
    const flows = flowsFromTransactions(
      [
        { type: 'BUY', quantity: 2, pricePerUnit: 100, fees: 10, date: '2026-01-05' },
        { type: 'SELL', quantity: 1, pricePerUnit: 150, fees: 5, date: '2026-01-20' },
      ],
      1.1
    );
    expect(flows[0].eur).toBeCloseTo(210 / 1.1, 9);
    expect(flows[1].eur).toBeCloseTo(-145 / 1.1, 9);
  });
});

describe('buildContributionSeries', () => {
  const now = new Date(2026, 3, 10); // abril 2026

  test('sin flujos devuelve métricas vacías', () => {
    expect(buildContributionSeries([], now)).toEqual({ months: [], metrics: emptyContributionMetrics() });
  });

  test('agrupa por mes, rellena huecos hasta el mes actual y calcula rachas', () => {
    const flows = [
      { date: new Date(2026, 0, 5), eur: 300 },
      { date: new Date(2026, 0, 20), eur: 200 },
      { date: new Date(2026, 1, 5), eur: 400 },
      { date: new Date(2026, 1, 15), eur: -100 },
      // marzo sin aportación
    ];

    const { months, metrics } = buildContributionSeries(flows, now);

    expect(months.map((m) => m.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(months[0]).toMatchObject({ inflowEur: 500, outflowEur: 0, netEur: 500, operations: 2 });
    expect(months[1]).toMatchObject({ inflowEur: 400, outflowEur: 100, netEur: 300, operations: 2 });
    expect(months[2]).toMatchObject({ inflowEur: 0, outflowEur: 0, netEur: 0, operations: 0 });
    expect(typeof months[0].label).toBe('string');

    expect(metrics.monthsTotal).toBe(4);
    expect(metrics.monthsWithContribution).toBe(2);
    expect(metrics.disciplineRate).toBe(50);
    expect(metrics.totalContributedEur).toBe(900);
    expect(metrics.totalWithdrawnEur).toBe(100);
    expect(metrics.netContributedEur).toBe(800);
    expect(metrics.avgMonthlyContribution).toBe(225);
    expect(metrics.avgMonthlyNet).toBe(200);
    expect(metrics.longestStreak).toBe(2);
    expect(metrics.currentStreak).toBe(0); // marzo rompe la racha
    expect(metrics.bestMonth).toEqual({ key: '2026-01', label: months[0].label, inflowEur: 500 });
    expect(metrics.firstMonth).toBe('2026-01');
    expect(metrics.lastMonth).toBe('2026-04');
  });

  test('el mes en curso sin aportación todavía no rompe la racha', () => {
    const flows = [
      { date: new Date(2026, 1, 5), eur: 100 },
      { date: new Date(2026, 2, 5), eur: 100 },
    ];
    const { metrics } = buildContributionSeries(flows, now);
    expect(metrics.currentStreak).toBe(2);
    expect(metrics.longestStreak).toBe(2);
  });

  test('ignora flujos con fecha inválida', () => {
    const { months } = buildContributionSeries([{ date: 'no-date', eur: 100 }], now);
    expect(months).toEqual([]);
  });
});
