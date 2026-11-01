import { fail, normalizeTicker, ok, toFiniteNumber, toValidDate } from './common.js';

export const TRANSACTION_TYPES = ['BUY', 'SELL'];
export const ASSET_TYPES = ['STOCK', 'CRYPTO'];

/**
 * Valida y normaliza el cuerpo de creación de una transacción.
 * @param {object} body
 * @returns {{ok:true,data:object}|{ok:false,error:string,status:number}}
 */
export function validateNewTransaction(body = {}) {
  const ticker = normalizeTicker(body.ticker ?? body.assetTicker);
  const type = typeof body.type === 'string' ? body.type.toUpperCase() : '';
  const assetType =
    body.assetType === undefined || body.assetType === null || body.assetType === ''
      ? 'STOCK'
      : String(body.assetType).toUpperCase();
  const quantity = toFiniteNumber(body.quantity);
  const pricePerUnit = toFiniteNumber(body.pricePerUnit);
  const fees =
    body.fees === undefined || body.fees === null || body.fees === '' ? 0 : toFiniteNumber(body.fees);
  const date = toValidDate(body.date);

  if (!ticker || !type || quantity === null || pricePerUnit === null || !body.date) {
    return fail('Faltan campos requeridos');
  }

  if (!TRANSACTION_TYPES.includes(type)) {
    return fail('Tipo de transacción inválido');
  }

  if (!ASSET_TYPES.includes(assetType)) {
    return fail('Tipo de asset inválido');
  }

  if (quantity <= 0 || pricePerUnit <= 0) {
    return fail('Cantidad y precio deben ser positivos');
  }

  if (fees === null || fees < 0) {
    return fail('Las comisiones no pueden ser negativas');
  }

  if (!date) {
    return fail('Fecha inválida');
  }

  return ok({ ticker, type, assetType, quantity, pricePerUnit, fees, date });
}

/**
 * Valida y normaliza una actualización parcial de transacción (solo los campos presentes).
 * @param {object} body
 */
export function validateTransactionUpdate(body = {}) {
  const updates = {};

  if (body.type !== undefined) {
    const type = typeof body.type === 'string' ? body.type.toUpperCase() : '';
    if (!TRANSACTION_TYPES.includes(type)) return fail('Tipo de transacción inválido');
    updates.type = type;
  }

  if (body.quantity !== undefined) {
    const quantity = toFiniteNumber(body.quantity);
    if (quantity === null || quantity <= 0) return fail('La cantidad debe ser positiva');
    updates.quantity = quantity;
  }

  if (body.pricePerUnit !== undefined) {
    const pricePerUnit = toFiniteNumber(body.pricePerUnit);
    if (pricePerUnit === null || pricePerUnit <= 0) return fail('El precio debe ser positivo');
    updates.pricePerUnit = pricePerUnit;
  }

  if (body.fees !== undefined) {
    const fees = toFiniteNumber(body.fees);
    if (fees === null || fees < 0) return fail('Las comisiones no pueden ser negativas');
    updates.fees = fees;
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
