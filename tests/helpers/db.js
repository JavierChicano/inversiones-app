/**
 * Utilidades para tests de integración contra la base de datos local de tests.
 */
import { client, db } from '@/lib/db/index';
import { assets, users } from '@/lib/db/schema';
import { generateToken } from '@/lib/auth/jwt';
import { hashPassword } from '@/lib/auth/password';

const TABLES_IN_DELETE_ORDER = [
  'staking_events',
  'staking_positions',
  'portfolio_reports',
  'currency_exchanges',
  'watchlist',
  'portfolio_snapshots',
  'transactions',
  'assets',
  'users',
];

/** Vacía todas las tablas (hijos antes que padres). */
export async function resetDatabase() {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await client.execute(`DELETE FROM "${table}"`);
  }
  await client.execute(`DELETE FROM sqlite_sequence`);
}

let userCounter = 0;

/** Crea un usuario de pruebas y devuelve { user, token, authHeaders }. */
export async function createTestUser({ email, password = 'secret123', name = 'Test User' } = {}) {
  userCounter += 1;
  const user = {
    id: `user_test_${userCounter}_${Date.now()}`,
    email: email || `user${userCounter}@test.com`,
    password: hashPassword(password),
    name,
    currencyPreference: 'USD',
    createdAt: new Date(),
  };

  await db.insert(users).values(user);

  const token = generateToken({ userId: user.id, email: user.email, name: user.name });
  return {
    user,
    token,
    authHeaders: { Authorization: `Bearer ${token}` },
  };
}

/** Inserta assets en la tabla maestra. */
export async function seedAssets(list) {
  await db.insert(assets).values(
    list.map((asset) => ({
      ticker: asset.ticker,
      type: asset.type || 'STOCK',
      name: asset.name || asset.ticker,
      currentPrice: asset.currentPrice ?? 0,
      lastUpdated: asset.lastUpdated || new Date(),
      isActive: asset.isActive ?? true,
    }))
  );
}

/** Consulta SQL cruda (devuelve filas como objetos). */
export async function query(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows;
}
