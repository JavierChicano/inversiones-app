import { describe, expect, test } from 'bun:test';
import {
  calculateCurrencyExchangeMetrics,
  calculateExchangeProfitLoss,
  calculateTargetRate,
  enrichExchange,
  summarizeExchanges,
} from '@/lib/utils/currencyExchangeMetrics';

const eurToUsd = (id, amount, rate, date) => ({ id, fromCurrency: 'EUR', toCurrency: 'USD', amount, exchangeRate: rate, date });
const usdToEur = (id, amount, rate, date) => ({ id, fromCurrency: 'USD', toCurrency: 'EUR', amount, exchangeRate: rate, date });

describe('calculateCurrencyExchangeMetrics (FIFO)', () => {
  test('cierra parcialmente el lote más antiguo y valora el resto al tipo actual', () => {
    const exchanges = [
      eurToUsd(1, 1000, 1.1, '2024-01-01'), // 1100 USD, coste 1000 EUR
      usdToEur(2, 550, 0.95, '2024-02-01'), // vende la mitad: coste 500 EUR, ingreso 522.5 EUR
    ];

    const { byId, summary } = calculateCurrencyExchangeMetrics(exchanges, 1.0);

    expect(byId.get(2)).toMatchObject({ mode: 'closed', basisEur: 500, proceedsEur: 522.5, differenceEur: 22.5 });
    expect(byId.get(2).percentage).toBeCloseTo(4.5, 9);

    expect(byId.get(1)).toMatchObject({ mode: 'open', basisEur: 1000, currentValueEur: 1100, differenceEur: 100, percentage: 10 });

    expect(summary.investedEur).toBe(1000);
    expect(summary.recoveredEur).toBe(522.5);
    expect(summary.openCostEur).toBe(500);
    expect(summary.openCurrentValueEur).toBe(550); // 550 USD restantes a 1.0
    expect(summary.openUnrealizedEur).toBe(50);
    expect(summary.realizedNetEur).toBe(22.5);
    expect(summary.totalNetEur).toBe(72.5);
    expect(summary.recoveryRate).toBeCloseTo(52.25, 9);
    expect(summary.openCount).toBe(1);
  });

  test('ordena por fecha aunque los ids lleguen desordenados', () => {
    const exchanges = [
      usdToEur(1, 1100, 1.0, '2024-03-01'),
      eurToUsd(2, 1000, 1.1, '2024-01-01'),
    ];
    const { summary } = calculateCurrencyExchangeMetrics(exchanges, 1.1);
    expect(summary.realizedNetEur).toBe(100);
    expect(summary.openCount).toBe(0);
  });

  test('USD vendidos sin lote de origen se valoran a su propio tipo (sin P&L artificial)', () => {
    const { byId, summary } = calculateCurrencyExchangeMetrics([usdToEur(1, 500, 0.9, '2024-01-01')], 1.1);
    expect(byId.get(1).basisEur).toBeCloseTo(450, 9);
    expect(byId.get(1).differenceEur).toBeCloseTo(0, 9);
    expect(summary.recoveredEur).toBe(450);
  });

  test('sin tipo actual, las posiciones abiertas se valoran a coste', () => {
    const { summary } = calculateCurrencyExchangeMetrics([eurToUsd(1, 1000, 1.1, '2024-01-01')], 0);
    expect(summary.openCurrentValueEur).toBe(1000);
    expect(summary.openUnrealizedEur).toBe(0);
  });

  test('lista vacía devuelve ceros', () => {
    const { summary } = calculateCurrencyExchangeMetrics([], 1.1);
    expect(summary).toEqual({
      investedEur: 0,
      recoveredEur: 0,
      openCostEur: 0,
      openCurrentValueEur: 0,
      openUnrealizedEur: 0,
      realizedNetEur: 0,
      totalNetEur: 0,
      recoveryRate: 0,
      openCount: 0,
    });
  });
});

describe('summarizeExchanges', () => {
  test('cuenta y suma por sentido', () => {
    const summary = summarizeExchanges([
      eurToUsd(1, 1000, 1.1),
      eurToUsd(2, 500, 1.2),
      usdToEur(3, 300, 0.9),
    ]);

    expect(summary).toEqual({
      totalExchanges: 3,
      eurToUsd: { count: 2, totalAmountEur: 1500, totalAmountUsd: 1700 },
      usdToEur: { count: 1, totalAmountUsd: 300, totalAmountEur: 270 },
    });
  });

  test('ignora valores no numéricos', () => {
    const summary = summarizeExchanges([{ fromCurrency: 'EUR', toCurrency: 'USD', amount: 'x', exchangeRate: null }]);
    expect(summary.eurToUsd).toEqual({ count: 1, totalAmountEur: 0, totalAmountUsd: 0 });
  });
});

describe('calculateExchangeProfitLoss', () => {
  test('EUR→USD: valora los USD obtenidos al tipo actual', () => {
    const result = calculateExchangeProfitLoss(1000, 1.1, 1.0, 'EUR');
    expect(result).toMatchObject({ originalValue: 1100, currentValue: 1100, isRealized: false, type: 'EUR→USD', isProfit: true });
    expect(result.difference).toBeCloseTo(100, 9);
    expect(result.percentage).toBeCloseTo(10, 9);
  });

  test('USD→EUR: compara los EUR obtenidos con los que daría el tipo actual (EUR por USD)', () => {
    // Obtuve 1045 EUR por 1100 USD (0.95). Hoy 1100 USD valdrían 990 EUR (0.9) → gané 55 EUR.
    const result = calculateExchangeProfitLoss(1100, 0.95, 0.9, 'USD');
    expect(result.originalValue).toBeCloseTo(1045, 9);
    expect(result.difference).toBeCloseTo(55, 9);
    expect(result.percentage).toBeCloseTo((55 / 990) * 100, 9);
    expect(result.isRealized).toBe(true);
    expect(result.isProfit).toBe(true);
  });

  test('USD→EUR con tipo actual más favorable es pérdida realizada', () => {
    const result = calculateExchangeProfitLoss(1100, 0.95, 1.0, 'USD');
    expect(result.difference).toBeCloseTo(-55, 9);
    expect(result.isProfit).toBe(false);
  });

  test('tipos a cero no producen NaN', () => {
    expect(calculateExchangeProfitLoss(1000, 1.1, 0, 'EUR').difference).toBe(0);
    expect(calculateExchangeProfitLoss(1000, 0.9, 0, 'USD').percentage).toBe(0);
  });
});

describe('calculateTargetRate', () => {
  test('objetivo del 5% y 10%', () => {
    expect(calculateTargetRate(1.1, 5)).toBeCloseTo(1.1 / 1.05, 12);
    expect(calculateTargetRate(1.1, 10)).toBeCloseTo(1.0, 12);
  });
});

describe('enrichExchange', () => {
  test('añade tipo actual, P&L y objetivos', () => {
    const enriched = enrichExchange(eurToUsd(7, 1000, 1.1, '2024-01-01'), 1.0);
    expect(enriched).toMatchObject({ id: 7, currentRate: 1.0, breakEvenRate: 1.1, isRealized: false });
    expect(enriched.goodTargetRate).toBeCloseTo(1.1 / 1.05, 12);
    expect(enriched.excellentTargetRate).toBeCloseTo(1.0, 12);
    expect(enriched.difference).toBeCloseTo(100, 9);
  });

  test('para USD→EUR usa el inverso del tipo EUR/USD', () => {
    const enriched = enrichExchange(usdToEur(8, 1100, 0.95, '2024-01-01'), 1.1);
    expect(enriched.currentRate).toBeCloseTo(1 / 1.1, 12);
    expect(enriched.difference).toBeCloseTo(1045 - 1000, 9);
  });

  test('con tipo actual inválido usa el valor por defecto', () => {
    const enriched = enrichExchange(eurToUsd(9, 1000, 1.1, '2024-01-01'), 0);
    expect(enriched.currentRate).toBe(1.08);
  });
});
