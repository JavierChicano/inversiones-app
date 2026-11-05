import { fail, normalizeTicker, ok, toFiniteNumber, toOptionalText, toValidDate } from './common.js';
import { CLOSE_REASONS, DIRECTIONS, LEVERAGED_ASSET_TYPES } from '../utils/leverage.js';

export const MAX_LEVERAGE = 500;

/** Alias aceptados en la API para el tipo de activo → tipo de la tabla `assets` */
const ASSET_TYPE_ALIASES = {
  STOCK: 'STOCK',
  ACCION: 'STOCK',
  CRYPTO: 'CRYPTO',
  INDEX: 'INDEX',
  INDICE: 'INDEX',
  FIAT: 'FIAT',
  FOREX: 'FIAT',
};

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

/** Número opcional: null si está vacío, undefined si no es numérico. */
function optionalNumber(value) {
  if (isBlank(value)) return null;
  const number = toFiniteNumber(value);
  return number === null ? undefined : number;
}

function normalizeAssetType(value) {
  if (isBlank(value)) return 'STOCK';
  const key = String(value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return ASSET_TYPE_ALIASES[key] || '';
}

/** Comprueba que SL/TP tienen sentido respecto al precio de entrada y la dirección. */
function validateProtectionLevels({ direction, entryPrice, stopLoss, takeProfit }) {
  if (stopLoss !== null) {
    if (stopLoss <= 0) return 'El stop loss debe ser mayor que 0';
    if (direction === 'LONG' && stopLoss >= entryPrice) return 'En largo, el stop loss debe estar por debajo del precio de entrada';
    if (direction === 'SHORT' && stopLoss <= entryPrice) return 'En corto, el stop loss debe estar por encima del precio de entrada';
  }

  if (takeProfit !== null) {
    if (takeProfit <= 0) return 'El take profit debe ser mayor que 0';
    if (direction === 'LONG' && takeProfit <= entryPrice) return 'En largo, el take profit debe estar por encima del precio de entrada';
    if (direction === 'SHORT' && takeProfit >= entryPrice) return 'En corto, el take profit debe estar por debajo del precio de entrada';
  }

  return null;
}

/**
 * Valida la apertura de una posición apalancada.
 * Body: { assetTicker|ticker, assetType?, direction, margin, leverage, entryPrice, openFee?, spread?,
 *         dailySwap?, stopLoss?, takeProfit?, notes?, openedAt }
 */
export function validateNewLeveragedPosition(body = {}) {
  const assetTicker = normalizeTicker(body.assetTicker ?? body.ticker);
  const assetType = normalizeAssetType(body.assetType);
  const direction = typeof body.direction === 'string' ? body.direction.trim().toUpperCase() : '';
  const margin = toFiniteNumber(body.margin);
  const leverage = toFiniteNumber(body.leverage);
  const entryPrice = toFiniteNumber(body.entryPrice);
  const openFee = isBlank(body.openFee) ? 0 : toFiniteNumber(body.openFee);
  const spread = isBlank(body.spread) ? 0 : toFiniteNumber(body.spread);
  const dailySwap = isBlank(body.dailySwap) ? 0 : toFiniteNumber(body.dailySwap);
  const stopLoss = optionalNumber(body.stopLoss);
  const takeProfit = optionalNumber(body.takeProfit);
  const notes = toOptionalText(body.notes, 500);
  const openedAt = toValidDate(body.openedAt ?? body.date);

  if (!assetTicker || !direction || margin === null || leverage === null || entryPrice === null || isBlank(body.openedAt ?? body.date)) {
    return fail('Faltan campos requeridos');
  }

  if (!assetType || !LEVERAGED_ASSET_TYPES.includes(assetType)) {
    return fail('Tipo de asset inválido');
  }

  if (!DIRECTIONS.includes(direction)) {
    return fail('Dirección inválida (LONG o SHORT)');
  }

  if (margin <= 0) {
    return fail('La garantía debe ser mayor que 0');
  }

  if (leverage < 1 || leverage > MAX_LEVERAGE) {
    return fail(`El multiplicador debe estar entre 1 y ${MAX_LEVERAGE}`);
  }

  if (entryPrice <= 0) {
    return fail('El precio de entrada debe ser mayor que 0');
  }

  if (openFee === null || spread === null || dailySwap === null || openFee < 0 || spread < 0 || dailySwap < 0) {
    return fail('Las comisiones no pueden ser negativas');
  }

  if (stopLoss === undefined || takeProfit === undefined) {
    return fail('Stop loss y take profit deben ser numéricos');
  }

  const protectionError = validateProtectionLevels({ direction, entryPrice, stopLoss, takeProfit });
  if (protectionError) return fail(protectionError);

  if (!openedAt) {
    return fail('Fecha de apertura inválida');
  }

  return ok({
    assetTicker,
    assetType,
    direction,
    margin,
    leverage,
    entryPrice,
    openFee,
    spread,
    dailySwap,
    stopLoss,
    takeProfit,
    notes,
    openedAt,
  });
}

/**
 * Valida el cierre de una posición.
 * Body: { closePrice?, closeFee?, closedAt?, reason? }
 * El precio de cierre es obligatorio salvo en liquidación (se usa el precio de liquidación estimado).
 */
export function validateCloseLeveragedPosition(body = {}) {
  const reason = isBlank(body.reason) ? 'MANUAL' : String(body.reason).trim().toUpperCase();
  const closePrice = optionalNumber(body.closePrice);
  const closeFee = isBlank(body.closeFee) ? 0 : toFiniteNumber(body.closeFee);
  const closedAt = isBlank(body.closedAt) ? new Date() : toValidDate(body.closedAt);

  if (!CLOSE_REASONS.includes(reason)) {
    return fail('Motivo de cierre inválido');
  }

  if (closePrice === undefined) {
    return fail('El precio de cierre debe ser numérico');
  }

  if (reason !== 'LIQUIDATION' && (closePrice === null || closePrice <= 0)) {
    return fail('El precio de cierre debe ser mayor que 0');
  }

  if (closePrice !== null && closePrice <= 0) {
    return fail('El precio de cierre debe ser mayor que 0');
  }

  if (closeFee === null || closeFee < 0) {
    return fail('La comisión de cierre no puede ser negativa');
  }

  if (!closedAt) {
    return fail('Fecha de cierre inválida');
  }

  return ok({ reason, closePrice, closeFee, closedAt });
}

/**
 * Valida una actualización parcial de una posición abierta (solo campos presentes).
 * Permite: stopLoss, takeProfit (null para quitarlos), dailySwap, spread, openFee, notes, openedAt.
 */
export function validateLeveragedPositionUpdate(body = {}, position = null) {
  const updates = {};

  if (body.stopLoss !== undefined) {
    const stopLoss = optionalNumber(body.stopLoss);
    if (stopLoss === undefined) return fail('El stop loss debe ser numérico');
    updates.stopLoss = stopLoss;
  }

  if (body.takeProfit !== undefined) {
    const takeProfit = optionalNumber(body.takeProfit);
    if (takeProfit === undefined) return fail('El take profit debe ser numérico');
    updates.takeProfit = takeProfit;
  }

  for (const field of ['dailySwap', 'spread', 'openFee']) {
    if (body[field] === undefined) continue;
    const value = isBlank(body[field]) ? 0 : toFiniteNumber(body[field]);
    if (value === null || value < 0) return fail('Las comisiones no pueden ser negativas');
    updates[field] = value;
  }

  if (body.notes !== undefined) {
    updates.notes = toOptionalText(body.notes, 500);
  }

  // Permite corregir la fecha y hora de apertura (p. ej. al registrar una posición pasada)
  if (body.openedAt !== undefined) {
    const openedAt = toValidDate(body.openedAt);
    if (!openedAt) return fail('Fecha de apertura inválida');
    updates.openedAt = openedAt;
  }

  if (Object.keys(updates).length === 0) {
    return fail('No hay campos para actualizar');
  }

  if (position && (updates.stopLoss !== undefined || updates.takeProfit !== undefined)) {
    const protectionError = validateProtectionLevels({
      direction: position.direction,
      entryPrice: Number(position.entryPrice),
      stopLoss: updates.stopLoss !== undefined ? updates.stopLoss : position.stopLoss ?? null,
      takeProfit: updates.takeProfit !== undefined ? updates.takeProfit : position.takeProfit ?? null,
    });
    if (protectionError) return fail(protectionError);
  }

  return ok(updates);
}
