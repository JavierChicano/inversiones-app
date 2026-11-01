import { describe, expect, test } from 'bun:test';
import {
  formatCoin,
  formatCurrency,
  formatDate,
  formatHoldingTime,
  formatHoldingTimeLong,
  formatMonthYear,
  formatPercent,
  formatQuantity,
  formatReportPeriod,
  formatSignedCurrency,
  formatSignedPercent,
  formatUsd,
} from '@/lib/utils/formatters';

// Intl puede usar espacios no separables; normalizamos para comparar
const norm = (s) => s.replace(/ | /g, ' ');

describe('formatHoldingTime', () => {
  test('días, meses y años', () => {
    expect(formatHoldingTime(0)).toBe('0d');
    expect(formatHoldingTime(15)).toBe('15d');
    expect(formatHoldingTime(30)).toBe('1m');
    expect(formatHoldingTime(45)).toBe('1m 15d');
    expect(formatHoldingTime(365)).toBe('1a');
    expect(formatHoldingTime(400)).toBe('1a 1m');
  });

  test('valores inválidos o negativos se tratan como 0', () => {
    expect(formatHoldingTime(-5)).toBe('0d');
    expect(formatHoldingTime(NaN)).toBe('0d');
    expect(formatHoldingTime(undefined)).toBe('0d');
  });
});

describe('formatHoldingTimeLong', () => {
  test('singular y plural', () => {
    expect(formatHoldingTimeLong(1)).toBe('1 día');
    expect(formatHoldingTimeLong(2)).toBe('2 días');
    expect(formatHoldingTimeLong(30)).toBe('1 mes');
    expect(formatHoldingTimeLong(61)).toBe('2 meses 1 día');
    expect(formatHoldingTimeLong(365)).toBe('1 año');
    expect(formatHoldingTimeLong(760)).toBe('2 años 1 mes');
  });
});

describe('formatCurrency / formatUsd', () => {
  test('formato español y americano', () => {
    expect(norm(formatCurrency(1234.5))).toBe('1234,50 €');
    expect(norm(formatCurrency(1234567.891, 'USD'))).toBe('1.234.567,89 US$');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(-5)).toBe('-$5.00');
  });

  test('valores no numéricos se formatean como 0', () => {
    expect(norm(formatCurrency(NaN))).toBe('0,00 €');
    expect(norm(formatCurrency('abc'))).toBe('0,00 €');
    expect(formatUsd(undefined)).toBe('$0.00');
  });

  test('las instancias de Intl se reutilizan (misma salida en llamadas repetidas)', () => {
    const a = formatCurrency(10);
    const b = formatCurrency(10);
    expect(a).toBe(b);
  });
});

describe('formatSignedCurrency', () => {
  test('añade + solo a positivos', () => {
    expect(norm(formatSignedCurrency(50))).toBe('+50,00 €');
    expect(norm(formatSignedCurrency(-50))).toBe('-50,00 €');
    expect(norm(formatSignedCurrency(0))).toBe('0,00 €');
  });
});

describe('formatCoin / formatQuantity', () => {
  test('decimales configurables', () => {
    expect(formatCoin(1234.56789)).toBe('1,234.5679');
    expect(formatCoin(1, { maximumFractionDigits: 6 })).toBe('1.00');
    expect(formatQuantity(1234.56789)).toBe('1234,56789');
  });
});

describe('formatPercent / formatSignedPercent', () => {
  test('con y sin signo', () => {
    expect(formatPercent(12.345)).toBe('12.35%');
    expect(formatSignedPercent(12.345)).toBe('+12.35%');
    expect(formatSignedPercent(-3)).toBe('-3.00%');
    expect(formatSignedPercent(0)).toBe('+0.00%');
    expect(formatSignedPercent(NaN, 1)).toBe('+0.0%');
  });
});

describe('formatDate', () => {
  test('fechas válidas e inválidas', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate('no-date')).toBe('-');
    expect(formatDate('2026-01-15T12:00:00Z')).toMatch(/15/);
  });
});

describe('formatMonthYear / formatReportPeriod', () => {
  test('convierte YYYY-MM a texto', () => {
    expect(formatMonthYear('2025-08')).toBe('agosto 2025');
    expect(formatMonthYear('')).toBe('');
    expect(formatMonthYear('2025')).toBe('2025');
  });

  test('periodos', () => {
    expect(formatReportPeriod('2025-08', '2026-08')).toBe('agosto 2025 - agosto 2026');
    expect(formatReportPeriod('2025-08', '2025-08')).toBe('agosto 2025');
    expect(formatReportPeriod('', '2025-08')).toBe('agosto 2025');
    expect(formatReportPeriod('2025-08', '')).toBe('agosto 2025');
  });
});
