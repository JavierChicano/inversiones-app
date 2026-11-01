import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@/lib/db/index';
import { transactions, watchlist } from '@/lib/db/schema';
import { POST as snapshot } from '@/app/api/cronjobs/snapshot/route';
import { POST as refreshAssets } from '@/app/api/cronjobs/refresh-assets/route';
import { POST as backupDb } from '@/app/api/cronjobs/backup-db/route';
import { POST as refreshUser } from '@/app/api/assets/refresh-user/route';
import { GET as listAssets } from '@/app/api/assets/route';
import { GET as getAsset, PUT as updateAsset } from '@/app/api/assets/[ticker]/route';
import { createTestUser, query, resetDatabase, seedAssets } from '../helpers/db.js';
import { installFetchMock } from '../helpers/fetchMock.js';
import { call } from '../helpers/http.js';

const cronHeaders = { Authorization: 'Bearer test-cron-secret' };
let fetchMock;

beforeEach(async () => {
  await resetDatabase();
  await seedAssets([
    { ticker: 'AAPL', type: 'STOCK', currentPrice: 110 },
    { ticker: 'OLD', type: 'STOCK', currentPrice: 5, isActive: true },
    { ticker: 'WATCHED', type: 'STOCK', currentPrice: 7, isActive: false },
    { ticker: 'EURUSD', type: 'FIAT', currentPrice: 1.1, isActive: false },
  ]);
});
afterEach(() => fetchMock?.restore());

describe('POST /api/cronjobs/snapshot', () => {
  test('rechaza sin CRON_SECRET', async () => {
    expect((await call(snapshot, '/api/cronjobs/snapshot', { method: 'POST' })).status).toBe(401);
    expect((await call(snapshot, '/api/cronjobs/snapshot', { method: 'POST', headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
  });

  test('activa/desactiva assets y guarda un snapshot por usuario con el método del dashboard', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const c = await createTestUser();
    await db.insert(transactions).values([
      { userId: a.user.id, assetTicker: 'AAPL', type: 'BUY', quantity: 10, pricePerUnit: 100, fees: 10, date: new Date('2024-01-01'), createdAt: new Date() },
      { userId: a.user.id, assetTicker: 'AAPL', type: 'BUY', quantity: 10, pricePerUnit: 80, fees: 0, date: new Date('2024-02-01'), createdAt: new Date() },
      { userId: a.user.id, assetTicker: 'AAPL', type: 'SELL', quantity: 5, pricePerUnit: 120, fees: 5, date: new Date('2024-03-01'), createdAt: new Date() },
      { userId: b.user.id, assetTicker: 'OLD', type: 'BUY', quantity: 1, pricePerUnit: 5, fees: 0, date: new Date('2024-01-01'), createdAt: new Date() },
      { userId: b.user.id, assetTicker: 'OLD', type: 'SELL', quantity: 1, pricePerUnit: 6, fees: 0, date: new Date('2024-02-01'), createdAt: new Date() },
    ]);
    await db.insert(watchlist).values({ userId: c.user.id, assetTicker: 'WATCHED', addedAt: new Date() });

    const { status, json } = await call(snapshot, '/api/cronjobs/snapshot', { method: 'POST', headers: cronHeaders });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.deactivatedTickers).toEqual(['OLD']);
    expect(json.assetsActivated).toBe(2); // WATCHED (watchlist) y EURUSD (siempre)
    expect(json.snapshots).toBe(2);

    const states = Object.fromEntries((await query('SELECT ticker, is_active FROM assets')).map((r) => [r.ticker, Number(r.is_active)]));
    expect(states).toEqual({ AAPL: 1, OLD: 0, WATCHED: 1, EURUSD: 1 });

    const rows = await query('SELECT user_id, total_invested, total_value FROM portfolio_snapshots ORDER BY user_id');
    expect(rows).toHaveLength(2);
    const forA = rows.find((r) => r.user_id === a.user.id);
    expect(Number(forA.total_invested)).toBe(1410); // lotes abiertos: 10@100+10 fees + 5@80
    expect(Number(forA.total_value)).toBe(15 * 110);
    const forB = rows.find((r) => r.user_id === b.user.id);
    expect(Number(forB.total_value)).toBe(0);

    const detailC = json.snapshotDetails.find((d) => d.userId === c.user.id);
    expect(detailC).toEqual({ userId: c.user.id, success: false, reason: 'no_transactions' });
  });

  test('sin usuarios termina sin snapshots', async () => {
    const { json } = await call(snapshot, '/api/cronjobs/snapshot', { method: 'POST', headers: cronHeaders });
    expect(json.snapshots).toBe(0);
    expect(json.message).toMatch(/no hay usuarios/);
  });
});

describe('POST /api/cronjobs/refresh-assets', () => {
  test('modo cron con CRON_SECRET actualiza todos los usuarios (el forex siempre, las acciones según mercado)', async () => {
    const { user } = await createTestUser();
    await db.insert(transactions).values({ userId: user.id, assetTicker: 'AAPL', type: 'BUY', quantity: 1, pricePerUnit: 1, fees: 0, date: new Date(), createdAt: new Date() });
    await query('UPDATE assets SET is_active = 1 WHERE ticker = ?', ['EURUSD']);
    fetchMock = installFetchMock([
      { match: /twelvedata.com\/price/, response: { price: '150' } },
      { match: /quote\?symbol=EUR%2FUSD/, response: { close: '1.2' } },
    ]);

    const { status, json } = await call(refreshAssets, '/api/cronjobs/refresh-assets', { method: 'POST', headers: cronHeaders });
    expect(status).toBe(200);
    expect(json.marketStatus).toMatch(/Mercado US/);
    expect(json.updated).toBeGreaterThanOrEqual(1);
    expect(Number((await query('SELECT current_price FROM assets WHERE ticker = ?', ['EURUSD']))[0].current_price)).toBe(1.2);
  });

  test('con JWT actualiza solo los activos del usuario; sin credenciales 401', async () => {
    const { user, authHeaders } = await createTestUser();
    await db.insert(transactions).values({ userId: user.id, assetTicker: 'AAPL', type: 'BUY', quantity: 1, pricePerUnit: 1, fees: 0, date: new Date(), createdAt: new Date() });
    fetchMock = installFetchMock([
      { match: /twelvedata.com\/price\?symbol=AAPL/, response: { price: '160' } },
      { match: /quote\?symbol=EUR%2FUSD/, response: { close: '1.3' } },
    ]);

    const asUser = await call(refreshAssets, '/api/cronjobs/refresh-assets', { method: 'POST', headers: authHeaders });
    expect(asUser.status).toBe(200);
    expect(asUser.json.marketStatus).toBeUndefined();
    expect(asUser.json.updated).toBe(2);

    const viaUserRoute = await call(refreshUser, '/api/assets/refresh-user', { method: 'POST', headers: authHeaders });
    expect(viaUserRoute.status).toBe(200);

    expect((await call(refreshAssets, '/api/cronjobs/refresh-assets', { method: 'POST', body: { userId: user.id } })).status).toBe(401);
    expect((await call(refreshUser, '/api/assets/refresh-user', { method: 'POST' })).status).toBe(401);
  });
});

describe('POST /api/cronjobs/backup-db', () => {
  test('rechaza sin CRON_SECRET', async () => {
    expect((await call(backupDb, '/api/cronjobs/backup-db', { method: 'POST' })).status).toBe(401);
  });

  test('con secreto pero sin credenciales R2 devuelve 500 con detalle', async () => {
    const saved = process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCOUNT_ID;
    const { status, json } = await call(backupDb, '/api/cronjobs/backup-db', { method: 'POST', headers: cronHeaders });
    if (saved !== undefined) process.env.R2_ACCOUNT_ID = saved;
    expect(status).toBe(500);
    expect(json.details).toMatch(/R2_/);
  });
});

describe('/api/assets', () => {
  test('GET lista y GET por ticker', async () => {
    const { authHeaders } = await createTestUser();

    const list = await call(listAssets, '/api/assets', { headers: authHeaders });
    expect(list.status).toBe(200);
    expect(list.json.assets.map((a) => a.ticker).sort()).toEqual(['AAPL', 'EURUSD', 'OLD', 'WATCHED']);

    const one = await call(getAsset, '/api/assets/aapl', { headers: authHeaders }, { ticker: 'aapl' });
    expect(one.status).toBe(200);
    expect(one.json).toMatchObject({ ticker: 'AAPL', currentPrice: 110 });

    expect((await call(getAsset, '/api/assets/NOPE', { headers: authHeaders }, { ticker: 'NOPE' })).status).toBe(404);
    expect((await call(getAsset, '/api/assets/AAPL', {}, { ticker: 'AAPL' })).status).toBe(401);
    expect((await call(listAssets, '/api/assets')).status).toBe(401);
  });

  test('PUT corrige precio y nombre con validación', async () => {
    const { authHeaders } = await createTestUser();
    const params = { ticker: 'AAPL' };

    const ok = await call(updateAsset, '/api/assets/AAPL', { method: 'PUT', headers: authHeaders, body: { currentPrice: '120.5', name: ' Apple ' } }, params);
    expect(ok.status).toBe(200);
    const [row] = await query('SELECT current_price, name FROM assets WHERE ticker = ?', ['AAPL']);
    expect(Number(row.current_price)).toBe(120.5);
    expect(row.name).toBe('Apple');

    expect((await call(updateAsset, '/api/assets/AAPL', { method: 'PUT', headers: authHeaders, body: { currentPrice: -1 } }, params)).status).toBe(400);
    expect((await call(updateAsset, '/api/assets/AAPL', { method: 'PUT', headers: authHeaders, body: {} }, params)).status).toBe(400);
    expect((await call(updateAsset, '/api/assets/NOPE', { method: 'PUT', headers: authHeaders, body: { currentPrice: 1 } }, { ticker: 'NOPE' })).status).toBe(404);
    expect((await call(updateAsset, '/api/assets/AAPL', { method: 'PUT', body: { currentPrice: 1 } }, params)).status).toBe(401);
  });
});
