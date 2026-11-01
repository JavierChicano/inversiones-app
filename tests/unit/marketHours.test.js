import { describe, expect, test } from 'bun:test';
import {
  easterSunday,
  getMarketStatus,
  getNewYorkTime,
  getUSMarketHolidays,
  isUSMarketHoliday,
  isUSMarketOpen,
  shouldUpdateAsset,
} from '@/lib/utils/marketHours';

describe('easterSunday', () => {
  test('coincide con fechas conocidas', () => {
    expect(easterSunday(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
    expect(easterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(easterSunday(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
  });
});

describe('getUSMarketHolidays', () => {
  test('2025 coincide con el calendario oficial de la NYSE', () => {
    expect(getUSMarketHolidays(2025)).toEqual([
      '2025-01-01',
      '2025-01-20',
      '2025-02-17',
      '2025-04-18',
      '2025-05-26',
      '2025-06-19',
      '2025-07-04',
      '2025-09-01',
      '2025-11-27',
      '2025-12-25',
    ]);
  });

  test('2026 coincide con el calendario oficial de la NYSE', () => {
    expect(getUSMarketHolidays(2026)).toEqual([
      '2026-01-01',
      '2026-01-19',
      '2026-02-16',
      '2026-04-03',
      '2026-05-25',
      '2026-06-19',
      '2026-07-03', // 4 de julio en sábado → viernes
      '2026-09-07',
      '2026-11-26',
      '2026-12-25',
    ]);
  });

  test('2027: festivos en domingo se observan el lunes', () => {
    const holidays = getUSMarketHolidays(2027);
    expect(holidays).toContain('2027-07-05'); // 4 de julio domingo
    expect(holidays).toContain('2027-01-01');
  });

  test('si el 1 de enero cae en sábado no se cierra el viernes anterior', () => {
    // 1 de enero de 2022 fue sábado
    expect(getUSMarketHolidays(2022)).not.toContain('2021-12-31');
    expect(getUSMarketHolidays(2022)).not.toContain('2022-01-01');
    expect(isUSMarketHoliday('2021-12-31')).toBe(false);
  });
});

describe('getNewYorkTime', () => {
  test('convierte UTC a hora de Nueva York (EDT y EST)', () => {
    // Julio: EDT (UTC-4)
    const summer = getNewYorkTime(new Date('2026-07-15T15:30:00Z'));
    expect(summer).toEqual({ dateKey: '2026-07-15', weekday: 3, hours: 11, minutes: 30 });

    // Diciembre: EST (UTC-5), cruzando medianoche
    const winter = getNewYorkTime(new Date('2026-12-16T03:10:00Z'));
    expect(winter).toEqual({ dateKey: '2026-12-15', weekday: 2, hours: 22, minutes: 10 });
  });
});

describe('isUSMarketOpen', () => {
  // Martes 10 de noviembre de 2026 (no festivo)
  test('abierto en horario de mercado', () => {
    expect(isUSMarketOpen(new Date('2026-11-10T14:30:00Z'))).toBe(true); // 9:30 ET
    expect(isUSMarketOpen(new Date('2026-11-10T18:00:00Z'))).toBe(true); // 13:00 ET
    expect(isUSMarketOpen(new Date('2026-11-10T21:29:00Z'))).toBe(true); // 16:29 ET (ventana extendida)
  });

  test('cerrado fuera de horario', () => {
    expect(isUSMarketOpen(new Date('2026-11-10T14:29:00Z'))).toBe(false); // 9:29 ET
    expect(isUSMarketOpen(new Date('2026-11-10T21:30:00Z'))).toBe(false); // 16:30 ET
    expect(isUSMarketOpen(new Date('2026-11-10T03:00:00Z'))).toBe(false); // 22:00 ET del día anterior
  });

  test('cerrado en fin de semana', () => {
    expect(isUSMarketOpen(new Date('2026-11-14T15:00:00Z'))).toBe(false); // sábado
    expect(isUSMarketOpen(new Date('2026-11-15T15:00:00Z'))).toBe(false); // domingo
  });

  test('cerrado en festivos', () => {
    expect(isUSMarketOpen(new Date('2026-11-26T15:00:00Z'))).toBe(false); // Thanksgiving
    expect(isUSMarketOpen(new Date('2026-07-03T15:00:00Z'))).toBe(false); // Independence Day observado
    expect(isUSMarketOpen(new Date('2026-04-03T15:00:00Z'))).toBe(false); // Good Friday
  });
});

describe('shouldUpdateAsset', () => {
  const closed = new Date('2026-11-15T15:00:00Z'); // domingo
  const open = new Date('2026-11-10T15:00:00Z');

  test('cripto y forex siempre se actualizan', () => {
    expect(shouldUpdateAsset('CRYPTO', closed)).toBe(true);
    expect(shouldUpdateAsset('FIAT', closed)).toBe(true);
  });

  test('acciones solo con mercado abierto', () => {
    expect(shouldUpdateAsset('STOCK', closed)).toBe(false);
    expect(shouldUpdateAsset('STOCK', open)).toBe(true);
  });

  test('tipos desconocidos no se actualizan', () => {
    expect(shouldUpdateAsset('BOND', open)).toBe(false);
    expect(shouldUpdateAsset(undefined, open)).toBe(false);
  });
});

describe('getMarketStatus', () => {
  test('devuelve mensaje coherente', () => {
    const status = getMarketStatus(new Date('2026-11-10T15:00:00Z'));
    expect(status.isOpen).toBe(true);
    expect(status.message).toBe('Mercado US ABIERTO');
    expect(typeof status.etTime).toBe('string');
  });
});
