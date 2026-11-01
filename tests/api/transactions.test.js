import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@/lib/db/index';
import { transactions } from '@/lib/db/schema';
import { GET as listTransactions, POST as createTransaction } from '@/app/api/transactions/route';
import { DELETE as deleteTransaction, GET as getTransaction, PUT as updateTransaction } from '@/app/api/transactions/[id]/route';
import { createTestUser, query, resetDatabase, seedAssets } from '../helpers/db.js';
import { installFetchMock } from '../helpers/fetchMock.js';
import { call } from '../helpers/http.js';

let fetchMock;
beforeEach(resetDatabase);
afterEach(() => fetchMock?.restore());

const validBody = { ticker: 'aapl', type: 'BUY', assetType: 'STOCK', quantity: 2, pricePerUnit: 150, fees: 1, date: '2026-01-15' };

describe('POST /api/transactions', () => {
  test('requiere autenticación', async () => {
    expect((await call(createTransaction, '/api/transactions', { method: 'POST', body: validBody })).status).toBe(401);
  });

  test('crea el asset consultando la API externa y la transacción', async () => {
    const { user, authHeaders } = await createTestUser();
    fetchMock = installFetchMock([{ match: /quote\?symbol=AAPL/, response: { name: 'Apple Inc', close: '151.5' } }]);

    const { status, json } = await call(createTransaction, '/api/transactions', { method: 'POST', headers: authHeaders, body: validBody });

    expect(status).toBe(201);
    expect(json.transactionId).toBeGreaterThan(0);
    expect(json.transaction).toMatchObject({ userId: user.id, assetTicker: 'AAPL', type: 'BUY', quantity: 2, pricePerUnit: 150, fees: 1 });

    const assets = await query('SELECT * FROM assets WHERE ticker = ?', ['AAPL']);
    expect(assets).toHaveLength(1);
    expect(assets[0].name).toBe('Apple Inc');
    expect(Number(assets[0].current_price)).toBe(151.5);
  });

  test('si el asset ya existe no llama a la API externa', async () => {
    const { authHeaders } = await createTestUser();
    await seedAssets([{ ticker: 'AAPL', currentPrice: 100 }]);
    fetchMock = installFetchMock([]);

    const { status } = await call(createTransaction, '/api/transactions', { method: 'POST', headers: authHeaders, body: validBody });
    expect(status).toBe(201);
    expect(fetchMock.calls).toHaveLength(0);
  });

  test('valida el cuerpo', async () => {
    const { authHeaders } = await createTestUser();
    const cases = [
      [{ ...validBody, quantity: 0 }, 'Cantidad y precio deben ser positivos'],
      [{ ...validBody, type: 'HOLD' }, 'Tipo de transacción inválido'],
      [{ ...validBody, date: 'x' }, 'Fecha inválida'],
      [{}, 'Faltan campos requeridos'],
    ];

    for (const [body, error] of cases) {
      const result = await call(createTransaction, '/api/transactions', { method: 'POST', headers: authHeaders, body });
      expect(result.status).toBe(400);
      expect(result.json.error).toBe(error);
    }
  });
});

describe('GET /api/transactions', () => {
  async function seedMany(userId, count) {
    await seedAssets([{ ticker: 'AAPL', currentPrice: 100, name: 'Apple' }]);
    await db.insert(transactions).values(
      Array.from({ length: count }, (_, i) => ({
        userId,
        assetTicker: 'AAPL',
        type: i % 2 === 0 ? 'BUY' : 'SELL',
        quantity: 1,
        pricePerUnit: 100 + i,
        fees: 0,
        date: new Date(2025, 0, 1 + i),
        createdAt: new Date(),
      }))
    );
  }

  test('devuelve todas las transacciones por defecto (no solo 100) y enriquece con el asset', async () => {
    const { user, authHeaders } = await createTestUser();
    await seedMany(user.id, 120);

    const { status, json } = await call(listTransactions, '/api/transactions', { headers: authHeaders });

    expect(status).toBe(200);
    expect(json.transactions).toHaveLength(120);
    expect(json.total).toBe(120);
    expect(json.transactions[0].asset).toMatchObject({ ticker: 'AAPL', name: 'Apple' });
    // más recientes primero
    expect(new Date(json.transactions[0].date).getTime()).toBeGreaterThan(new Date(json.transactions[1].date).getTime());
  });

  test('aplica límite, offset y filtros', async () => {
    const { user, authHeaders } = await createTestUser();
    await seedMany(user.id, 10);

    const paged = await call(listTransactions, '/api/transactions?limit=3&offset=2', { headers: authHeaders });
    expect(paged.json.transactions).toHaveLength(3);
    expect(paged.json.total).toBe(10);
    expect(paged.json.limit).toBe(3);

    const sells = await call(listTransactions, '/api/transactions?type=sell', { headers: authHeaders });
    expect(sells.json.transactions.every((tx) => tx.type === 'SELL')).toBe(true);
    expect(sells.json.transactions).toHaveLength(5);

    const ranged = await call(listTransactions, '/api/transactions?startDate=2025-01-05&endDate=2025-01-07', { headers: authHeaders });
    expect(ranged.json.transactions).toHaveLength(3);

    const other = await call(listTransactions, '/api/transactions?ticker=msft', { headers: authHeaders });
    expect(other.json.transactions).toHaveLength(0);
  });

  test('solo devuelve las transacciones del usuario autenticado', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await seedMany(a.user.id, 3);

    const { json } = await call(listTransactions, '/api/transactions', { headers: b.authHeaders });
    expect(json.transactions).toHaveLength(0);
    expect(json.total).toBe(0);
  });
});

describe('/api/transactions/[id]', () => {
  async function seedOne(userId) {
    await seedAssets([{ ticker: 'AAPL', currentPrice: 100 }]);
    const [row] = await db
      .insert(transactions)
      .values({ userId, assetTicker: 'AAPL', type: 'BUY', quantity: 1, pricePerUnit: 100, fees: 0, date: new Date('2025-01-01'), createdAt: new Date() })
      .returning();
    return row;
  }

  test('GET devuelve la transacción propia y 404 para ajenas o inexistentes', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const row = await seedOne(owner.user.id);

    const mine = await call(getTransaction, `/api/transactions/${row.id}`, { headers: owner.authHeaders }, { id: String(row.id) });
    expect(mine.status).toBe(200);
    expect(mine.json.id).toBe(row.id);

    const foreign = await call(getTransaction, `/api/transactions/${row.id}`, { headers: other.authHeaders }, { id: String(row.id) });
    expect(foreign.status).toBe(404);

    const missing = await call(getTransaction, '/api/transactions/9999', { headers: owner.authHeaders }, { id: '9999' });
    expect(missing.status).toBe(404);

    const invalid = await call(getTransaction, '/api/transactions/abc', { headers: owner.authHeaders }, { id: 'abc' });
    expect(invalid.status).toBe(400);
  });

  test('PUT actualiza campos válidos y rechaza inválidos', async () => {
    const owner = await createTestUser();
    const row = await seedOne(owner.user.id);

    const ok = await call(updateTransaction, `/api/transactions/${row.id}`, {
      method: 'PUT',
      headers: owner.authHeaders,
      body: { type: 'SELL', quantity: 0.5, pricePerUnit: 120, fees: 2, date: '2025-02-01' },
    }, { id: String(row.id) });
    expect(ok.status).toBe(200);

    const [updated] = await query('SELECT * FROM transactions WHERE id = ?', [row.id]);
    expect(updated.type).toBe('SELL');
    expect(Number(updated.quantity)).toBe(0.5);
    expect(Number(updated.price_per_unit)).toBe(120);
    expect(Number(updated.fees)).toBe(2);

    const bad = await call(updateTransaction, `/api/transactions/${row.id}`, { method: 'PUT', headers: owner.authHeaders, body: { quantity: -1 } }, { id: String(row.id) });
    expect(bad.status).toBe(400);

    const empty = await call(updateTransaction, `/api/transactions/${row.id}`, { method: 'PUT', headers: owner.authHeaders, body: {} }, { id: String(row.id) });
    expect(empty.status).toBe(400);
  });

  test('DELETE elimina solo transacciones propias', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const row = await seedOne(owner.user.id);

    const foreign = await call(deleteTransaction, `/api/transactions/${row.id}`, { method: 'DELETE', headers: other.authHeaders }, { id: String(row.id) });
    expect(foreign.status).toBe(404);
    expect(await query('SELECT id FROM transactions WHERE id = ?', [row.id])).toHaveLength(1);

    const mine = await call(deleteTransaction, `/api/transactions/${row.id}`, { method: 'DELETE', headers: owner.authHeaders }, { id: String(row.id) });
    expect(mine.status).toBe(200);
    expect(await query('SELECT id FROM transactions WHERE id = ?', [row.id])).toHaveLength(0);
  });
});
