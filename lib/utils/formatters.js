/**
 * Utilidades de formateo para la aplicación
 */

/**
 * Formatea un número de días en un formato legible (días, meses, años)
 * @param {number} days - Número de días
 * @returns {string} - Tiempo formateado (ej: "15d", "3m 15d", "1a 3m")
 */
export function formatHoldingTime(days) {
  if (days < 30) {
    return `${days}d`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return remainingDays > 0 ? `${months}m ${remainingDays}d` : `${months}m`;
  } else {
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    return remainingMonths > 0 ? `${years}a ${remainingMonths}m` : `${years}a`;
  }
}

/**
 * Formatea un número de días en formato largo legible (para descripciones)
 * @param {number} days - Número de días
 * @returns {string} - Tiempo formateado (ej: "15 días", "3 meses 15 días", "1 año 3 meses")
 */
export function formatHoldingTimeLong(days) {
  if (days < 30) {
    return `${days} ${days === 1 ? 'día' : 'días'}`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    if (remainingDays > 0) {
      return `${months} ${months === 1 ? 'mes' : 'meses'} ${remainingDays} ${remainingDays === 1 ? 'día' : 'días'}`;
    }
    return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  } else {
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    if (remainingMonths > 0) {
      return `${years} ${years === 1 ? 'año' : 'años'} ${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`;
    }
    return `${years} ${years === 1 ? 'año' : 'años'}`;
  }
}

/**
 * Formatea un importe como moneda en formato español
 * @param {number} value - Importe
 * @param {string} currency - Código ISO ('EUR' o 'USD')
 * @returns {string} - Importe formateado (ej: "1.234,56 €")
 */
export function formatCurrency(value, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/**
 * Formatea un importe como moneda con signo explícito
 * @param {number} value - Importe
 * @param {string} currency - Código ISO ('EUR' o 'USD')
 * @returns {string} - Importe formateado (ej: "+1.234,56 €", "-50,00 €")
 */
export function formatSignedCurrency(value, currency = 'EUR') {
  const safe = Number.isFinite(value) ? value : 0;
  const prefix = safe > 0 ? '+' : '';
  return `${prefix}${formatCurrency(safe, currency)}`;
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
