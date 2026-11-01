import { fail, ok, toFiniteNumber, toValidDate } from './common.js';
import { SUPPORTED_CURRENCIES } from '../utils/currencyExchangeMetrics.js';

function normalizeCurrency(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

/**
 * Valida el cuerpo de creación de un cambio de divisa.
 */
export function validateNewCurrencyExchange(body = {}) {
  const fromCurrency = normalizeCurrency(body.fromCurrency);
  const toCurrency = normalizeCurrency(body.toCurrency);
  const amount = toFiniteNumber(body.amount);
  const exchangeRate = toFiniteNumber(body.exchangeRate);
  const date = toValidDate(body.date);

  if (!fromCurrency || !toCurrency || amount === null || exchangeRate === null || !body.date) {
    return fail('Faltan campos requeridos');
  }

  if (!SUPPORTED_CURRENCIES.includes(fromCurrency) || !SUPPORTED_CURRENCIES.includes(toCurrency)) {
    return fail('Divisas no soportadas');
  }

  if (fromCurrency === toCurrency) {
    return fail('Las divisas deben ser diferentes');
  }

  if (amount <= 0 || exchangeRate <= 0) {
    return fail('Cantidad y tipo de cambio deben ser positivos');
  }

  if (!date) {
    return fail('Fecha inválida');
  }

  return ok({ fromCurrency, toCurrency, amount, exchangeRate, date });
}

/**
 * Valida una actualización parcial de un cambio de divisa.
 * @param {object} body
 * @param {object} existing - Registro actual (para comprobar coherencia de divisas)
 */
export function validateCurrencyExchangeUpdate(body = {}, existing = {}) {
  const updates = {};

  if (body.fromCurrency !== undefined) {
    const fromCurrency = normalizeCurrency(body.fromCurrency);
    if (!SUPPORTED_CURRENCIES.includes(fromCurrency)) return fail('Divisas no soportadas');
    updates.fromCurrency = fromCurrency;
  }

  if (body.toCurrency !== undefined) {
    const toCurrency = normalizeCurrency(body.toCurrency);
    if (!SUPPORTED_CURRENCIES.includes(toCurrency)) return fail('Divisas no soportadas');
    updates.toCurrency = toCurrency;
  }

  const finalFrom = updates.fromCurrency ?? existing.fromCurrency;
  const finalTo = updates.toCurrency ?? existing.toCurrency;
  if (finalFrom && finalTo && finalFrom === finalTo) {
    return fail('Las divisas deben ser diferentes');
  }

  if (body.amount !== undefined) {
    const amount = toFiniteNumber(body.amount);
    if (amount === null || amount <= 0) return fail('La cantidad debe ser positiva');
    updates.amount = amount;
  }

  if (body.exchangeRate !== undefined) {
    const exchangeRate = toFiniteNumber(body.exchangeRate);
    if (exchangeRate === null || exchangeRate <= 0) return fail('El tipo de cambio debe ser positivo');
    updates.exchangeRate = exchangeRate;
  }

  if (body.date !== undefined) {
    const date = toValidDate(body.date);
    if (!date) return fail('Fecha inválida');
    updates.date = date;
  }

  if (Object.keys(updates).length === 0) {
    return fail('No hay campos para actualizar');
  }

  return ok(updates);
}
