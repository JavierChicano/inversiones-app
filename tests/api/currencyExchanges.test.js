import { beforeEach, describe, expect, test } from 'bun:test';
import { GET as listExchanges, POST as createExchange } from '@/app/api/currency-exchanges/route';
import { DELETE as deleteExchange, GET as getExchange, PUT as updateExchange } from '@/app/api/currency-exchanges/[id]/route';
import { createTestUser, query, resetDatabase, seedAssets } from '../helpers/db.js';
import { call } from '../helpers/http.js';

beforeEach(async () => {
  await resetDatabase();
  await seedAssets([{ ticker: 'EURUSD', type: 'FIAT', currentPrice: 1.1 }]);
});

const eurToUsd = { fromCurrency: 'EUR', toCurrency: 'USD', amount: 1000, exchangeRate: 1.2, date: '2026-01-10' };
const usdToEur = { fromCurrency: 'USD', toCurrency: 'EUR', amount: 1100, exchangeRate: 0.95, date: '2026-02-10' };

describe('POST /api/currency-exchanges', () => {
  test('crea y valida', async () => {
    const { user, authHeaders } = await createTestUser();

    const created = await call(createExchange, '/api/currency-exchanges', { method: 'POST', headers: authHeaders, body: eurToUsd });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ userId: user.id, fromCurrency: 'EUR', toCurrency: 'USD', amount: 1000, exchangeRate: 1.2 });

    const same = await call(createExchange, '/api/currency-exchanges', { method: 'POST', headers: authHeaders, body: { ...eurToUsd, toCurrency: 'EUR' } });
    expect(same.status).toBe(400);
    expect(same.json.error).toBe('Las divisas deben ser diferentes');

    expect((await call(createExchange, '/api/currency-exchanges', { method: 'POST', body: eurToUsd })).status).toBe(401);
  });
});

describe('GET /api/currency-exchanges', () => {
  test('enriquece con el tipo actual, P&L correcto en ambos sentidos y resumen', async () => {
    const { authHeaders } = await createTestUser();
    await call(createExchange, '/api/currency-exchanges', { method: 'POST', headers: authHeaders, body: eurToUsd });
    await call(createExchange, '/api/currency-exchanges', { method: 'POST', headers: authHeaders, body: usdToEur });

    const { status, json } = await call(listExchanges, '/api/currency-exchanges', { headers: authHeaders });
    expect(status).toBe(200);
    expect(json.currentRate.eurToUsd).toBe(1.1);
    expect(json.currentRate.usdToEur).toBeCloseTo(1 / 1.1, 12);
    expect(json.exchanges).toHaveLength(2);

    // Más reciente primero
    const [usd, eur] = json.exchanges;
    expect(eur.fromCurrency).toBe('EUR');
    expect(eur.currentRate).toBe(1.1);
    // 1000 EUR → 1200 USD; hoy valen 1200/1.1 = 1090.9 EUR → +90.9
    expect(eur.difference).toBeCloseTo(1200 / 1.1 - 1000, 9);
    expect(eur.isRealized).toBe(false);

    expect(usd.fromCurrency).toBe('USD');
    expect(usd.currentRate).toBeCloseTo(1 / 1.1, 12);
    // Obtuve 1045 EUR; al tipo actual 1100 USD darían 1000 EUR → +45 realizados
    expect(usd.difference).toBeCloseTo(45, 9);
    expect(usd.isRealized).toBe(true);
    expect(usd.breakEvenRate).toBe(0.95);

    expect(json.summary).toEqual({
      totalExchanges: 2,
      eurToUsd: { count: 1, totalAmountEur: 1000, totalAmountUsd: 1200 },
      usdToEur: { count: 1, totalAmountUsd: 1100, totalAmountEur: 1045 },
    });
  });

  test('sin EURUSD en assets usa el tipo por defecto', async () => {
    await query('DELETE FROM assets');
    const { authHeaders } = await createTestUser();
    const { json } = await call(listExchanges, '/api/currency-exchanges', { headers: authHeaders });
    expect(json.currentRate.eurToUsd).toBe(1.08);
    expect(json.exchanges).toEqual([]);
  });
});

describe('/api/currency-exchanges/[id]', () => {
  test('GET, PUT y DELETE respetan la propiedad', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const created = await call(createExchange, '/api/currency-exchanges', { method: 'POST', headers: owner.authHeaders, body: eurToUsd });
    const id = created.json.id;
    const params = { id: String(id) };

    expect((await call(getExchange, `/api/currency-exchanges/${id}`, { headers: owner.authHeaders }, params)).status).toBe(200);
    expect((await call(getExchange, `/api/currency-exchanges/${id}`, { headers: other.authHeaders }, params)).status).toBe(404);
    expect((await call(getExchange, '/api/currency-exchanges/x', { headers: owner.authHeaders }, { id: 'x' })).status).toBe(400);

    const updated = await call(updateExchange, `/api/currency-exchanges/${id}`, { method: 'PUT', headers: owner.authHeaders, body: { amount: 500, exchangeRate: 1.3 } }, params);
    expect(updated.status).toBe(200);
    expect(updated.json).toMatchObject({ id, amount: 500, exchangeRate: 1.3, fromCurrency: 'EUR' });

    const incoherent = await call(updateExchange, `/api/currency-exchanges/${id}`, { method: 'PUT', headers: owner.authHeaders, body: { toCurrency: 'EUR' } }, params);
    expect(incoherent.status).toBe(400);

    expect((await call(deleteExchange, `/api/currency-exchanges/${id}`, { method: 'DELETE', headers: other.authHeaders }, params)).status).toBe(404);
    expect((await call(deleteExchange, `/api/currency-exchanges/${id}`, { method: 'DELETE', headers: owner.authHeaders }, params)).status).toBe(200);
    expect(await query('SELECT id FROM currency_exchanges WHERE id = ?', [id])).toHaveLength(0);
  });
});
