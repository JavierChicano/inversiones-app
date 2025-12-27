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
