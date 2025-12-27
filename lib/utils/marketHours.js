/**
 * Utilidad para determinar si los mercados bursátiles están abiertos
 */

// Festivos de mercado USA para 2025 y 2026 (Formato MM-DD)
// Puedes actualizar esta lista cada año o usar una librería como 'date-holidays'
const MARKET_HOLIDAYS = [
  '01-01', // Año Nuevo
  '01-20', // Martin Luther King Jr. (2025)
  '02-17', // Washington's Birthday (2025)
  '04-18', // Good Friday (2025)
  '05-26', // Memorial Day
  '06-19', // Juneteenth
  '07-04', // Independence Day
  '09-01', // Labor Day
  '11-27', // Thanksgiving
  '12-25', // Navidad
];

export function isUSMarketOpen() {
  const now = new Date();
  
  // 1. Obtener fecha y hora en New York
  const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  const dayOfWeek = etDate.getDay(); // 0 = Domingo, 6 = Sábado
  const hours = etDate.getHours();
  const minutes = etDate.getMinutes();
  
  // 2. Comprobar Fin de Semana
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // 3. Comprobar Festivos
  // Formateamos a MM-DD para comparar con la lista
  const month = String(etDate.getMonth() + 1).padStart(2, '0');
  const day = String(etDate.getDate()).padStart(2, '0');
  const dateString = `${month}-${day}`;

  if (MARKET_HOLIDAYS.includes(dateString)) {
    return false;
  }

  const totalMinutes = hours * 60 + minutes;

  // Mercado abre 9:30 AM = 570 min
  const marketOpen = 9 * 60 + 30; 
  
  // MEJORA: Extendemos el cierre hasta las 4:30 PM (16:30 = 990 min)
  // Esto permite que el Cron de las 16:00 o 16:20 capture el precio final de cierre.
  const updateWindowClose = 16 * 60 + 30; 

  return totalMinutes >= marketOpen && totalMinutes < updateWindowClose;
}

/**
 * Determina si se debe actualizar un asset según su tipo y el estado del mercado
 * @param {string} assetType - Tipo de asset: 'CRYPTO', 'STOCK', 'FIAT'
 * @returns {boolean} true si se debe actualizar
 */
export function shouldUpdateAsset(assetType) {
  // CRYPTO: siempre actualizar (mercado 24/7)
  if (assetType === 'CRYPTO') {
    return true;
  }

  // FIAT: siempre actualizar (forex opera 24/5, pero para simplificar actualizamos siempre)
  if (assetType === 'FIAT') {
    return true;
  }

  // STOCK: solo actualizar si el mercado está abierto
  if (assetType === 'STOCK') {
    return isUSMarketOpen();
  }

  // Por defecto, no actualizar tipos desconocidos
  return false;
}

/**
 * Obtiene información del estado del mercado para logging
 * @returns {object} Información del mercado
 */
export function getMarketStatus() {
  const isOpen = isUSMarketOpen();
  const now = new Date();
  const etTime = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    hour12: true,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    isOpen,
    etTime,
    message: isOpen ? 'Mercado US ABIERTO' : 'Mercado US CERRADO'
  };
}
