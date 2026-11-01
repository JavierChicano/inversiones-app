/**
 * Horario y festivos de la bolsa de EE. UU. (NYSE / Nasdaq).
 * Los festivos se calculan algorítmicamente para cualquier año, incluyendo las reglas de
 * "día observado" (sábado → viernes anterior, domingo → lunes siguiente).
 */

const NY_TIME_ZONE = 'America/New_York';

/** weekday: Domingo = 0 ... Sábado = 6 (como Date#getDay). month: 1-12 */
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (n - 1) * 7));
}

function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month - 1, last.getUTCDate() - offset));
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher), en UTC */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Sábado → viernes anterior; domingo → lunes siguiente */
function observed(date) {
  const day = date.getUTCDay();
  const result = new Date(date);
  if (day === 6) result.setUTCDate(result.getUTCDate() - 1);
  if (day === 0) result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

function toKey(date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Festivos de mercado de un año en formato 'YYYY-MM-DD'.
 * @param {number} year
 * @returns {string[]}
 */
export function getUSMarketHolidays(year) {
  const newYear = new Date(Date.UTC(year, 0, 1));
  const holidays = [];

  // Si el 1 de enero cae en sábado, la NYSE no cierra el viernes 31 de diciembre anterior
  if (newYear.getUTCDay() !== 6) holidays.push(observed(newYear));

  holidays.push(nthWeekdayOfMonth(year, 1, 1, 3)); // Martin Luther King Jr.
  holidays.push(nthWeekdayOfMonth(year, 2, 1, 3)); // Presidents' Day
  const goodFriday = easterSunday(year);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  holidays.push(goodFriday);
  holidays.push(lastWeekdayOfMonth(year, 5, 1)); // Memorial Day
  holidays.push(observed(new Date(Date.UTC(year, 5, 19)))); // Juneteenth
  holidays.push(observed(new Date(Date.UTC(year, 6, 4)))); // Independence Day
  holidays.push(nthWeekdayOfMonth(year, 9, 1, 1)); // Labor Day
  holidays.push(nthWeekdayOfMonth(year, 11, 4, 4)); // Thanksgiving
  holidays.push(observed(new Date(Date.UTC(year, 11, 25)))); // Christmas

  return holidays.map(toKey).sort();
}

const holidayCache = new Map();

/**
 * @param {string} dateKey - 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isUSMarketHoliday(dateKey) {
  const year = Number(dateKey.slice(0, 4));
  if (!holidayCache.has(year)) {
    holidayCache.set(year, new Set(getUSMarketHolidays(year)));
  }
  return holidayCache.get(year).has(dateKey);
}

const nyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NY_TIME_ZONE,
  hourCycle: 'h23',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Fecha y hora en Nueva York descompuesta.
 * @param {Date} [date]
 * @returns {{ dateKey: string, weekday: number, hours: number, minutes: number }}
 */
export function getNewYorkTime(date = new Date()) {
  const parts = {};
  for (const part of nyFormatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    hours: Number(parts.hour) % 24,
    minutes: Number(parts.minute),
  };
}

// El mercado abre a las 9:30 ET. La ventana de actualización se extiende hasta las 16:30 ET
// para que el cron posterior al cierre (16:00) capture el precio final del día.
const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const UPDATE_WINDOW_CLOSE_MINUTES = 16 * 60 + 30;

/**
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isUSMarketOpen(now = new Date()) {
  const ny = getNewYorkTime(now);

  if (ny.weekday === 0 || ny.weekday === 6) return false;
  if (isUSMarketHoliday(ny.dateKey)) return false;

  const totalMinutes = ny.hours * 60 + ny.minutes;
  return totalMinutes >= MARKET_OPEN_MINUTES && totalMinutes < UPDATE_WINDOW_CLOSE_MINUTES;
}

/**
 * Determina si se debe actualizar un asset según su tipo y el estado del mercado
 * @param {string} assetType - 'CRYPTO', 'STOCK' o 'FIAT'
 * @param {Date} [now]
 * @returns {boolean}
 */
export function shouldUpdateAsset(assetType, now = new Date()) {
  if (assetType === 'CRYPTO' || assetType === 'FIAT') return true;
  if (assetType === 'STOCK') return isUSMarketOpen(now);
  return false;
}

/**
 * Información del estado del mercado para logging
 * @param {Date} [now]
 */
export function getMarketStatus(now = new Date()) {
  const isOpen = isUSMarketOpen(now);
  const etTime = now.toLocaleString('en-US', {
    timeZone: NY_TIME_ZONE,
    hour12: true,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    isOpen,
    etTime,
    message: isOpen ? 'Mercado US ABIERTO' : 'Mercado US CERRADO',
  };
}
