import { fail, normalizeTicker, ok, toFiniteNumber, toOptionalText } from './common.js';
import { ASSET_TYPES } from './transaction.js';

export const MAX_WATCHLIST_NOTES_LENGTH = 500;

// Tickers de cripto habituales para inferir el tipo cuando el cliente no lo indica
const KNOWN_CRYPTO_TICKERS = new Set([
  'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'TRX', 'TON', 'LINK',
  'AVAX', 'DOT', 'MATIC', 'POL', 'UNI', 'LTC', 'BCH', 'ATOM', 'NEAR', 'SUI', 'APT', 'ARB',
  'OP', 'XLM', 'HBAR', 'ALGO', 'VET', 'FIL', 'ICP', 'INJ', 'TIA', 'SHIB', 'PEPE', 'KAS',
]);

export function inferAssetType(ticker) {
  return KNOWN_CRYPTO_TICKERS.has(ticker) ? 'CRYPTO' : 'STOCK';
}

function parseTargetPrice(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  const number = toFiniteNumber(value);
  if (number === null || number <= 0) return { error: 'El precio objetivo debe ser positivo' };
  return { value: number };
}

/**
 * Valida el alta de un activo en la watchlist.
 */
export function validateNewWatchlistItem(body = {}) {
  const assetTicker = normalizeTicker(body.assetTicker ?? body.ticker);
  if (!assetTicker) {
    return fail('Ticker requerido');
  }

  const assetType = body.assetType ? String(body.assetType).toUpperCase() : inferAssetType(assetTicker);
  if (!ASSET_TYPES.includes(assetType)) {
    return fail('Tipo de asset inválido');
  }

  const targetPrice = parseTargetPrice(body.targetPrice);
  if (targetPrice.error) return fail(targetPrice.error);

  const notes = toOptionalText(body.notes, MAX_WATCHLIST_NOTES_LENGTH);

  return ok({ assetTicker, assetType, targetPrice: targetPrice.value, notes });
}

/**
 * Valida una actualización parcial de un item de watchlist.
 */
export function validateWatchlistUpdate(body = {}) {
  const updates = {};

  if (body.targetPrice !== undefined) {
    const targetPrice = parseTargetPrice(body.targetPrice);
    if (targetPrice.error) return fail(targetPrice.error);
    updates.targetPrice = targetPrice.value;
  }

  if (body.notes !== undefined) {
    updates.notes = toOptionalText(body.notes, MAX_WATCHLIST_NOTES_LENGTH);
  }

  if (Object.keys(updates).length === 0) {
    return fail('No hay campos para actualizar');
  }

  return ok(updates);
}
