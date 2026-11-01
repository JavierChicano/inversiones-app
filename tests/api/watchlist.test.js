import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { GET as listWatchlist, POST as addToWatchlist } from '@/app/api/watchlist/route';
import { DELETE as deleteItem, PATCH as updateItem } from '@/app/api/watchlist/[id]/route';
import { createTestUser, query, resetDatabase, seedAssets } from '../helpers/db.js';
import { installFetchMock } from '../helpers/fetchMock.js';
import { call } from '../helpers/http.js';

let fetchMock;
beforeEach(resetDatabase);
afterEach(() => fetchMock?.restore());

describe('POST /api/watchlist', () => {
  test('crea el asset (infiriendo el tipo) y el item', async () => {
    const { user, authHeaders } = await createTestUser();
    fetchMock = installFetchMock([
      { match: /coins\/solana/, response: { name: 'Solana', market_data: { current_price: { usd: 150 } } } },
    ]);

    const { status, json } = await call(addToWatchlist, '/api/watchlist', { method: 'POST', headers: authHeaders, body: { assetTicker: 'sol', targetPrice: 100, notes: 'esperar' } });

    expect(status).toBe(201);
    expect(json.item).toMatchObject({ userId: user.id, assetTicker: 'SOL', targetPrice: 100, notes: 'esperar' });

    const [asset] = await query('SELECT * FROM assets WHERE ticker = ?', ['SOL']);
    expect(asset.type).toBe('CRYPTO');
    expect(asset.name).toBe('Solana');
  });

  test('si la API externa falla el asset se crea igualmente con datos básicos', async () => {
    const { authHeaders } = await createTestUser();
    fetchMock = installFetchMock([{ match: /.*/, status: 500, response: {} }]);

    const { status } = await call(addToWatchlist, '/api/watchlist', { method: 'POST', headers: authHeaders, body: { assetTicker: 'NVDA' } });
    expect(status).toBe(201);

    const [asset] = await query('SELECT * FROM assets WHERE ticker = ?', ['NVDA']);
    expect(asset.type).toBe('STOCK');
    expect(Number(asset.current_price)).toBe(0);
  });

  test('validaciones y autenticación', async () => {
    const { authHeaders } = await createTestUser();
    expect((await call(addToWatchlist, '/api/watchlist', { method: 'POST', headers: authHeaders, body: {} })).status).toBe(400);
    expect((await call(addToWatchlist, '/api/watchlist', { method: 'POST', headers: authHeaders, body: { assetTicker: 'AAPL', targetPrice: -5 } })).status).toBe(400);
    expect((await call(addToWatchlist, '/api/watchlist', { method: 'POST', body: { assetTicker: 'AAPL' } })).status).toBe(401);
  });
});

describe('GET /api/watchlist', () => {
  test('enriquece con precio actual y estado del objetivo', async () => {
    const { authHeaders } = await createTestUser();
    await seedAssets([
      { ticker: 'AAPL', type: 'STOCK', currentPrice: 90, name: 'Apple' },
      { ticker: 'MSFT', type: 'STOCK', currentPrice: 300, name: 'Microsoft' },
    ]);
    await call(addToWatchlist, '/api/watchlist', { method: 'POST', headers: authHeaders, body: { assetTicker: 'AAPL', targetPrice: 100 } });
    await call(addToWatchlist, '/api/watchlist', { method: 'POST', headers: authHeaders, body: { assetTicker: 'MSFT', targetPrice: 250 } });

    const { status, json } = await call(listWatchlist, '/api/watchlist', { headers: authHeaders });
    expect(status).toBe(200);
    expect(json.watchlist).toHaveLength(2);

    const aapl = json.watchlist.find((i) => i.assetTicker === 'AAPL');
    expect(aapl).toMatchObject({ name: 'Apple', type: 'STOCK', currentPrice: 90, targetReached: true });
    expect(aapl.priceVsTarget).toBeCloseTo(10, 9);

    const msft = json.watchlist.find((i) => i.assetTicker === 'MSFT');
    expect(msft.targetReached).toBe(false);
    expect(msft.priceVsTarget).toBeCloseTo(-20, 9);
  });

  test('sin precio objetivo no calcula desviación', async () => {
    const { authHeaders } = await createTestUser();
    await seedAssets([{ ticker: 'AAPL', currentPrice: 90 }]);
    await call(addToWatchlist, '/api/watchlist', { method: 'POST', headers: authHeaders, body: { assetTicker: 'AAPL' } });

    const { json } = await call(listWatchlist, '/api/watchlist', { headers: authHeaders });
    expect(json.watchlist[0].priceVsTarget).toBeNull();
    expect(json.watchlist[0].targetReached).toBe(false);
  });
});

describe('/api/watchlist/[id]', () => {
  test('PATCH y DELETE solo sobre items propios', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    await seedAssets([{ ticker: 'AAPL', currentPrice: 90 }]);
    const created = await call(addToWatchlist, '/api/watchlist', { method: 'POST', headers: owner.authHeaders, body: { assetTicker: 'AAPL', targetPrice: 100 } });
    const id = created.json.item.id;
    const params = { id: String(id) };

    const updated = await call(updateItem, `/api/watchlist/${id}`, { method: 'PATCH', headers: owner.authHeaders, body: { targetPrice: 80, notes: 'bajada' } }, params);
    expect(updated.status).toBe(200);
    expect(updated.json.item).toMatchObject({ id, targetPrice: 80, notes: 'bajada' });

    const cleared = await call(updateItem, `/api/watchlist/${id}`, { method: 'PATCH', headers: owner.authHeaders, body: { targetPrice: null } }, params);
    expect(cleared.json.item.targetPrice).toBeNull();

    expect((await call(updateItem, `/api/watchlist/${id}`, { method: 'PATCH', headers: owner.authHeaders, body: {} }, params)).status).toBe(400);
    expect((await call(updateItem, `/api/watchlist/${id}`, { method: 'PATCH', headers: other.authHeaders, body: { notes: 'x' } }, params)).status).toBe(404);
    expect((await call(deleteItem, `/api/watchlist/${id}`, { method: 'DELETE', headers: other.authHeaders }, params)).status).toBe(404);
    expect((await call(deleteItem, `/api/watchlist/${id}`, { method: 'DELETE', headers: owner.authHeaders }, params)).status).toBe(200);
    expect((await call(deleteItem, `/api/watchlist/${id}`, { method: 'DELETE', headers: owner.authHeaders }, params)).status).toBe(404);
    expect((await call(deleteItem, '/api/watchlist/x', { method: 'DELETE', headers: owner.authHeaders }, { id: 'x' })).status).toBe(400);
  });
});
