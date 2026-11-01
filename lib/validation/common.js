/** Helpers de validación compartidos por las rutas de la API. */

export const TICKER_REGEX = /^[A-Z0-9.\-/]{1,20}$/;

/** Normaliza un ticker: mayúsculas y sin espacios. Devuelve '' si no es válido. */
export function normalizeTicker(value) {
  if (typeof value !== 'string') return '';
  const ticker = value.trim().toUpperCase();
  return TICKER_REGEX.test(ticker) ? ticker : '';
}

/** Convierte a número finito; devuelve null si no se puede. */
export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(number) ? number : null;
}

/** Convierte a Date válida (acepta 'YYYY-MM-DD', ISO 8601 o timestamp). Devuelve null si no lo es. */
export function toValidDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Texto recortado y limitado en longitud; devuelve null si queda vacío. */
export function toOptionalText(value, maxLength = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

export function ok(data) {
  return { ok: true, data };
}

export function fail(error, status = 400) {
  return { ok: false, error, status };
}
