/**
 * Utilidades de formateo para la aplicación.
 * Las instancias de Intl.NumberFormat se cachean: crearlas es costoso y las tablas
 * llaman a estas funciones cientos de veces por render.
 */

const numberFormatCache = new Map();

function getNumberFormat(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, formatter);
  }
  return formatter;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Formatea un número de días en un formato legible (días, meses, años)
 * @param {number} days - Número de días
 * @returns {string} - Tiempo formateado (ej: "15d", "3m 15d", "1a 3m")
 */
export function formatHoldingTime(days) {
  const safeDays = Math.max(0, Math.floor(safeNumber(days)));

  if (safeDays < 30) {
    return `${safeDays}d`;
  } else if (safeDays < 365) {
    const months = Math.floor(safeDays / 30);
    const remainingDays = safeDays % 30;
    return remainingDays > 0 ? `${months}m ${remainingDays}d` : `${months}m`;
  }

  const years = Math.floor(safeDays / 365);
  const remainingMonths = Math.floor((safeDays % 365) / 30);
  return remainingMonths > 0 ? `${years}a ${remainingMonths}m` : `${years}a`;
}

/**
 * Formatea un número de días en formato largo legible (para descripciones)
 * @param {number} days - Número de días
 * @returns {string} - Tiempo formateado (ej: "15 días", "3 meses 15 días", "1 año 3 meses")
 */
export function formatHoldingTimeLong(days) {
  const safeDays = Math.max(0, Math.floor(safeNumber(days)));

  if (safeDays < 30) {
    return `${safeDays} ${safeDays === 1 ? 'día' : 'días'}`;
  } else if (safeDays < 365) {
    const months = Math.floor(safeDays / 30);
    const remainingDays = safeDays % 30;
    if (remainingDays > 0) {
      return `${months} ${months === 1 ? 'mes' : 'meses'} ${remainingDays} ${remainingDays === 1 ? 'día' : 'días'}`;
    }
    return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  }

  const years = Math.floor(safeDays / 365);
  const remainingMonths = Math.floor((safeDays % 365) / 30);
  if (remainingMonths > 0) {
    return `${years} ${years === 1 ? 'año' : 'años'} ${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`;
  }
  return `${years} ${years === 1 ? 'año' : 'años'}`;
}

/**
 * Formatea un importe como moneda en formato español
 * @param {number} value - Importe
 * @param {string} currency - Código ISO ('EUR' o 'USD')
 * @returns {string} - Importe formateado (ej: "1.234,56 €")
 */
export function formatCurrency(value, currency = 'EUR') {
  return getNumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));
}

/**
 * Formatea un importe en dólares con formato americano (ej: "$1,234.56")
 * @param {number} value
 * @returns {string}
 */
export function formatUsd(value) {
  return getNumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));
}

/**
 * Formatea un importe como moneda con signo explícito
 * @param {number} value - Importe
 * @param {string} currency - Código ISO ('EUR' o 'USD')
 * @returns {string} - Importe formateado (ej: "+1.234,56 €", "-50,00 €")
 */
export function formatSignedCurrency(value, currency = 'EUR') {
  const safe = safeNumber(value);
  const prefix = safe > 0 ? '+' : '';
  return `${prefix}${formatCurrency(safe, currency)}`;
}

/**
 * Formatea una cantidad de tokens/acciones (formato americano, sin símbolo)
 * @param {number} value
 * @param {{ minimumFractionDigits?: number, maximumFractionDigits?: number }} [options]
 * @returns {string}
 */
export function formatCoin(value, { minimumFractionDigits = 2, maximumFractionDigits = 4 } = {}) {
  return getNumberFormat('en-US', { minimumFractionDigits, maximumFractionDigits }).format(safeNumber(value));
}

/**
 * Formatea una cantidad en formato español (ej: "1.234,5678")
 * @param {number} value
 * @param {{ minimumFractionDigits?: number, maximumFractionDigits?: number }} [options]
 * @returns {string}
 */
export function formatQuantity(value, { minimumFractionDigits = 2, maximumFractionDigits = 8 } = {}) {
  return getNumberFormat('es-ES', { minimumFractionDigits, maximumFractionDigits }).format(safeNumber(value));
}

/**
 * Formatea un porcentaje con signo explícito (ej: "+12.34%", "-3.00%")
 * @param {number} value
 * @param {number} [decimals]
 * @returns {string}
 */
export function formatSignedPercent(value, decimals = 2) {
  const safe = safeNumber(value);
  return `${safe >= 0 ? '+' : ''}${safe.toFixed(decimals)}%`;
}

/**
 * Formatea un porcentaje sin signo (ej: "12.34%")
 * @param {number} value
 * @param {number} [decimals]
 * @returns {string}
 */
export function formatPercent(value, decimals = 2) {
  return `${safeNumber(value).toFixed(decimals)}%`;
}

/**
 * Formatea una fecha en formato corto español (ej: "15 ene 2026"). Devuelve '-' si no es válida.
 * @param {*} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-ES', options);
}

/**
 * Convierte una clave de mes 'YYYY-MM' en texto legible
 * @param {string} monthKey - Mes en formato 'YYYY-MM'
 * @returns {string} - Mes formateado (ej: "agosto 2025")
 */
export function formatMonthYear(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';

  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString('es-ES', { month: 'long' });

  return `${monthName} ${year}`;
}

/**
 * Formatea el periodo de un informe
 * @param {string} periodStart - Mes inicial 'YYYY-MM'
 * @param {string} periodEnd - Mes final 'YYYY-MM'
 * @returns {string} - Periodo formateado (ej: "agosto 2025 - agosto 2026")
 */
export function formatReportPeriod(periodStart, periodEnd) {
  const start = formatMonthYear(periodStart);
  const end = formatMonthYear(periodEnd);

  if (!start) return end;
  if (!end || start === end) return start;

  return `${start} - ${end}`;
}
