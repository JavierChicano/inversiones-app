import { describe, expect, test } from 'bun:test';
import { normalizeTicker, toFiniteNumber, toOptionalText, toValidDate } from '@/lib/validation/common';
import { validateNewTransaction, validateTransactionUpdate } from '@/lib/validation/transaction';
import { validateCurrencyExchangeUpdate, validateNewCurrencyExchange } from '@/lib/validation/currencyExchange';
import { validateNewStakingPosition, validateUnstake } from '@/lib/validation/staking';
import { inferAssetType, validateNewWatchlistItem, validateWatchlistUpdate } from '@/lib/validation/watchlist';
import { validateLogin, validatePasswordChange, validateRegistration } from '@/lib/validation/auth';
import { parseReportId, validateNewReport, validateReportNotes } from '@/lib/validation/reports';
import { MAX_REPORT_BYTES } from '@/lib/utils/reports';

describe('common', () => {
  test('normalizeTicker', () => {
    expect(normalizeTicker(' aapl ')).toBe('AAPL');
    expect(normalizeTicker('brk.b')).toBe('BRK.B');
    expect(normalizeTicker('EUR/USD')).toBe('EUR/USD');
    expect(normalizeTicker('bad ticker')).toBe('');
    expect(normalizeTicker('')).toBe('');
    expect(normalizeTicker(42)).toBe('');
    expect(normalizeTicker('A'.repeat(21))).toBe('');
  });

  test('toFiniteNumber', () => {
    expect(toFiniteNumber('12.5')).toBe(12.5);
    expect(toFiniteNumber(3)).toBe(3);
    expect(toFiniteNumber('')).toBeNull();
    expect(toFiniteNumber('abc')).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
    expect(toFiniteNumber(null)).toBeNull();
  });

  test('toValidDate', () => {
    expect(toValidDate('2026-01-15')).toBeInstanceOf(Date);
    expect(toValidDate('2026-01-15T10:00:00Z').toISOString()).toBe('2026-01-15T10:00:00.000Z');
    expect(toValidDate('nope')).toBeNull();
    expect(toValidDate('')).toBeNull();
    expect(toValidDate(undefined)).toBeNull();
  });

  test('toOptionalText', () => {
    expect(toOptionalText('  hola  ')).toBe('hola');
    expect(toOptionalText('   ')).toBeNull();
    expect(toOptionalText(null)).toBeNull();
    expect(toOptionalText('abcdef', 3)).toBe('abc');
  });
});

describe('transactions', () => {
  const valid = { ticker: 'aapl', type: 'buy', assetType: 'stock', quantity: '2', pricePerUnit: 150, fees: '1.5', date: '2026-01-15' };

  test('normaliza un cuerpo válido', () => {
    const result = validateNewTransaction(valid);
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ ticker: 'AAPL', type: 'BUY', assetType: 'STOCK', quantity: 2, pricePerUnit: 150, fees: 1.5 });
    expect(result.data.date).toBeInstanceOf(Date);
  });

  test('assetType por defecto STOCK y fees por defecto 0', () => {
    const result = validateNewTransaction({ ticker: 'BTC', type: 'BUY', quantity: 1, pricePerUnit: 1, date: '2026-01-01' });
    expect(result.data.assetType).toBe('STOCK');
    expect(result.data.fees).toBe(0);
  });

  test('rechaza campos faltantes o inválidos', () => {
    expect(validateNewTransaction({}).error).toBe('Faltan campos requeridos');
    expect(validateNewTransaction({ ...valid, type: 'HOLD' }).error).toBe('Tipo de transacción inválido');
    expect(validateNewTransaction({ ...valid, assetType: 'BOND' }).error).toBe('Tipo de asset inválido');
    expect(validateNewTransaction({ ...valid, quantity: 0 }).error).toBe('Cantidad y precio deben ser positivos');
    expect(validateNewTransaction({ ...valid, pricePerUnit: -1 }).error).toBe('Cantidad y precio deben ser positivos');
    expect(validateNewTransaction({ ...valid, fees: -1 }).error).toBe('Las comisiones no pueden ser negativas');
    expect(validateNewTransaction({ ...valid, date: 'ayer' }).error).toBe('Fecha inválida');
    expect(validateNewTransaction({ ...valid, ticker: 'not valid' }).error).toBe('Faltan campos requeridos');
  });

  test('actualización parcial', () => {
    expect(validateTransactionUpdate({}).error).toBe('No hay campos para actualizar');
    expect(validateTransactionUpdate({ quantity: 0 }).error).toBe('La cantidad debe ser positiva');
    expect(validateTransactionUpdate({ pricePerUnit: 'x' }).error).toBe('El precio debe ser positivo');
    expect(validateTransactionUpdate({ fees: -2 }).error).toBe('Las comisiones no pueden ser negativas');
    expect(validateTransactionUpdate({ date: 'x' }).error).toBe('Fecha inválida');
    expect(validateTransactionUpdate({ type: 'x' }).error).toBe('Tipo de transacción inválido');

    const result = validateTransactionUpdate({ type: 'sell', fees: 0 });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ type: 'SELL', fees: 0 });
  });
});

describe('currency exchanges', () => {
  const valid = { fromCurrency: 'eur', toCurrency: 'usd', amount: '1000', exchangeRate: 1.1, date: '2026-01-01' };

  test('válido', () => {
    const result = validateNewCurrencyExchange(valid);
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ fromCurrency: 'EUR', toCurrency: 'USD', amount: 1000, exchangeRate: 1.1 });
  });

  test('inválidos', () => {
    expect(validateNewCurrencyExchange({}).error).toBe('Faltan campos requeridos');
    expect(validateNewCurrencyExchange({ ...valid, fromCurrency: 'GBP' }).error).toBe('Divisas no soportadas');
    expect(validateNewCurrencyExchange({ ...valid, toCurrency: 'EUR' }).error).toBe('Las divisas deben ser diferentes');
    expect(validateNewCurrencyExchange({ ...valid, amount: 0 }).error).toBe('Cantidad y tipo de cambio deben ser positivos');
    expect(validateNewCurrencyExchange({ ...valid, date: 'x' }).error).toBe('Fecha inválida');
  });

  test('actualización coherente con el registro existente', () => {
    const existing = { fromCurrency: 'EUR', toCurrency: 'USD' };
    expect(validateCurrencyExchangeUpdate({ toCurrency: 'EUR' }, existing).error).toBe('Las divisas deben ser diferentes');
    expect(validateCurrencyExchangeUpdate({}, existing).error).toBe('No hay campos para actualizar');
    expect(validateCurrencyExchangeUpdate({ amount: -1 }, existing).error).toBe('La cantidad debe ser positiva');
    const result = validateCurrencyExchangeUpdate({ fromCurrency: 'usd', toCurrency: 'eur', exchangeRate: '0.9' }, existing);
    expect(result.data).toEqual({ fromCurrency: 'USD', toCurrency: 'EUR', exchangeRate: 0.9 });
  });
});

describe('staking', () => {
  const valid = { assetTicker: 'eth', amountStaked: '1.5', manualApy: 5, lockPeriodDays: '3', startDate: '2026-01-01' };

  test('válido', () => {
    const result = validateNewStakingPosition(valid);
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ assetTicker: 'ETH', amountStaked: 1.5, manualApy: 5, lockPeriodDays: 3 });
  });

  test('inválidos', () => {
    expect(validateNewStakingPosition({}).error).toBe('Faltan campos requeridos');
    expect(validateNewStakingPosition({ ...valid, amountStaked: 0 }).error).toBe('Cantidad y APY deben ser valores válidos');
    expect(validateNewStakingPosition({ ...valid, manualApy: -1 }).error).toBe('Cantidad y APY deben ser valores válidos');
    expect(validateNewStakingPosition({ ...valid, lockPeriodDays: -1 }).error).toBe('El período de bloqueo no puede ser negativo');
    expect(validateNewStakingPosition({ ...valid, lockPeriodDays: 1.5 }).error).toBe('El período de bloqueo no puede ser negativo');
    expect(validateNewStakingPosition({ ...valid, startDate: 'x' }).error).toBe('Fecha de inicio inválida');
  });

  test('unstake', () => {
    expect(validateUnstake({ amountToUnstake: 0 }).error).toBe('La cantidad a retirar debe ser mayor que 0');
    expect(validateUnstake({ amountToUnstake: '0.5' }).data).toEqual({ amountToUnstake: 0.5 });
  });
});

describe('watchlist', () => {
  test('infiere el tipo de asset', () => {
    expect(inferAssetType('BTC')).toBe('CRYPTO');
    expect(inferAssetType('AAPL')).toBe('STOCK');
  });

  test('alta', () => {
    expect(validateNewWatchlistItem({}).error).toBe('Ticker requerido');
    expect(validateNewWatchlistItem({ assetTicker: 'AAPL', targetPrice: -1 }).error).toBe('El precio objetivo debe ser positivo');
    expect(validateNewWatchlistItem({ assetTicker: 'AAPL', assetType: 'BOND' }).error).toBe('Tipo de asset inválido');

    const result = validateNewWatchlistItem({ assetTicker: ' sol ', targetPrice: '120', notes: '  ok  ' });
    expect(result.data).toEqual({ assetTicker: 'SOL', assetType: 'CRYPTO', targetPrice: 120, notes: 'ok' });

    const noTarget = validateNewWatchlistItem({ assetTicker: 'AAPL', targetPrice: null });
    expect(noTarget.data.targetPrice).toBeNull();
  });

  test('actualización', () => {
    expect(validateWatchlistUpdate({}).error).toBe('No hay campos para actualizar');
    expect(validateWatchlistUpdate({ targetPrice: 'x' }).error).toBe('El precio objetivo debe ser positivo');
    expect(validateWatchlistUpdate({ targetPrice: '', notes: '' }).data).toEqual({ targetPrice: null, notes: null });
  });
});

describe('auth', () => {
  test('registro', () => {
    expect(validateRegistration({}).error).toBe('Email y contraseña son requeridos');
    expect(validateRegistration({ email: 'bad', password: '123456' }).error).toBe('Formato de email inválido');
    expect(validateRegistration({ email: 'a@b.com', password: '123' }).error).toBe('La contraseña debe tener al menos 6 caracteres');
    expect(validateRegistration({ email: 'a@b.com', password: 'x'.repeat(129) }).error).toBe('La contraseña no puede superar 128 caracteres');

    const result = validateRegistration({ email: ' A@B.com ', password: '123456', name: '  Ana  ' });
    expect(result.data).toEqual({ email: 'a@b.com', password: '123456', name: 'Ana' });
    expect(validateRegistration({ email: 'a@b.com', password: '123456' }).data.name).toBeNull();
  });

  test('login', () => {
    expect(validateLogin({ email: 'a@b.com' }).error).toBe('Email y contraseña son requeridos');
    expect(validateLogin({ email: 'A@B.com', password: 'x' }).data).toEqual({ email: 'a@b.com', password: 'x' });
  });

  test('cambio de contraseña', () => {
    expect(validatePasswordChange({}).error).toBe('Todos los campos son obligatorios');
    expect(validatePasswordChange({ currentPassword: 'a', newPassword: 'b', confirmPassword: 'b' }).error).toBe('La nueva contraseña debe tener al menos 6 caracteres');
    expect(validatePasswordChange({ currentPassword: 'a', newPassword: 'bbbbbb', confirmPassword: 'cccccc' }).error).toBe('La confirmación no coincide con la nueva contraseña');
    expect(validatePasswordChange({ currentPassword: 'bbbbbb', newPassword: 'bbbbbb', confirmPassword: 'bbbbbb' }).error).toBe('La nueva contraseña no puede ser igual a la actual');
    expect(validatePasswordChange({ currentPassword: 'aaaaaa', newPassword: 'bbbbbb', confirmPassword: 'bbbbbb' }).ok).toBe(true);
  });
});

describe('reports', () => {
  const html = '<!DOCTYPE html><html><body>Informe</body></html>';
  const valid = { title: 'Radiografía', periodStart: '2025-08', periodEnd: '2026-08', html };

  test('parseReportId', () => {
    expect(parseReportId('12')).toBe(12);
    expect(parseReportId('0')).toBeNull();
    expect(parseReportId('abc')).toBeNull();
    expect(parseReportId('1.5')).toBeNull();
  });

  test('válido', () => {
    const result = validateNewReport({ ...valid, notes: '  nota ' });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ title: 'Radiografía', periodStart: '2025-08', periodEnd: '2026-08', notes: 'nota' });
    expect(result.data.sizeBytes).toBe(Buffer.byteLength(html));
  });

  test('inválidos', () => {
    expect(validateNewReport({ ...valid, title: '' }).error).toBe('El título es obligatorio');
    expect(validateNewReport({ ...valid, title: 'x'.repeat(121) }).error).toMatch(/título/);
    expect(validateNewReport({ ...valid, periodStart: '2025-13' }).error).toBe('El periodo debe indicarse en formato YYYY-MM');
    expect(validateNewReport({ ...valid, periodStart: '2027-01' }).error).toBe('El mes inicial no puede ser posterior al mes final');
    expect(validateNewReport({ ...valid, html: '   ' }).error).toBe('El archivo HTML está vacío');
    expect(validateNewReport({ ...valid, html: 'just text' }).error).toBe('El archivo no parece un documento HTML válido');
    expect(validateNewReport({ ...valid, notes: 'x'.repeat(20001) }).error).toMatch(/notas/);

    const tooBig = validateNewReport({ ...valid, html: `<html>${'a'.repeat(MAX_REPORT_BYTES)}</html>` });
    expect(tooBig.status).toBe(413);
  });

  test('notas', () => {
    expect(validateReportNotes({ notes: 42 }).error).toBe('Las notas deben ser texto');
    expect(validateReportNotes({ notes: '   ' }).data).toEqual({ notes: null });
    expect(validateReportNotes({ notes: ' hola ' }).data).toEqual({ notes: 'hola' });
  });
});
