import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@/lib/db/index';
import { transactions } from '@/lib/db/schema';
import { refreshAssetsForUsers } from '@/lib/services/assetRefresh.service';
import { createTestUser, query, resetDatabase, seedAssets } from '../helpers/db.js';
import { installFetchMock } from '../helpers/fetchMock.js';

const MARKET_OPEN = new Date('2026-11-10T15:00:00Z'); // martes 10:00 ET
const MARKET_CLOSED = new Date('2026-11-15T15:00:00Z'); // domingo

let fetchMock;

async function priceOf(ticker) {
  const rows = await query('SELECT current_price AS price, last_updated AS updated FROM assets WHERE ticker = ?', [ticker]);
  return { price: Number(rows[0].price), updated: rows[0].updated };
}

beforeEach(async () => {
  await resetDatabase();
  await seedAssets([
    { ticker: 'AAPL', type: 'STOCK', currentPrice: 100 },
    { ticker: 'MSFT', type: 'STOCK', currentPrice: 200 },
    { ticker: 'OLD', type: 'STOCK', currentPrice: 5, isActive: false },
    { ticker: 'BTC', type: 'CRYPTO', currentPrice: 60000 },
    { ticker: 'ETH', type: 'CRYPTO', currentPrice: 3000 },
    { ticker: 'EURUSD', type: 'FIAT', currentPrice: 1.05 },
  ]);
});

afterEach(() => fetchMock?.restore());

async function seedUserWithTickers(tickers) {
  const { user } = await createTestUser();
  await db.insert(transactions).values(
    tickers.map((ticker) => ({
      userId: user.id,
      assetTicker: ticker,
      type: 'BUY',
      quantity: 1,
      pricePerUnit: 1,
      fees: 0,
      date: new Date('2026-01-01'),
      createdAt: new Date(),
    }))
  );
  return user;
}

describe('refreshAssetsForUsers', () => {
  test('actualiza acciones en batch, criptos en una llamada y el forex', async () => {
    const user = await seedUserWithTickers(['AAPL', 'MSFT', 'BTC', 'ETH']);
    fetchMock = installFetchMock([
      { match: /twelvedata.com\/price\?symbol=AAPL%2CMSFT/, response: { AAPL: { price: '110' }, MSFT: { price: '210' } } },
      { match: /simple\/price\?ids=bitcoin,ethereum/, response: { bitcoin: { usd: 65000 }, ethereum: { usd: 3100 } } },
      { match: /quote\?symbol=EUR%2FUSD/, response: { close: '1.0900' } },
    ]);

    const result = await refreshAssetsForUsers({ userIds: [user.id], now: MARKET_OPEN });

    expect(result.success).toBe(true);
    expect(result.total).toBe(5);
    expect(result.updated).toBe(5);
    expect(result.failed).toBe(0);
    expect(fetchMock.calls).toHaveLength(3);

    expect((await priceOf('AAPL')).price).toBe(110);
    expect((await priceOf('MSFT')).price).toBe(210);
    expect((await priceOf('BTC')).price).toBe(65000);
    expect((await priceOf('ETH')).price).toBe(3100);
    expect((await priceOf('EURUSD')).price).toBe(1.09);
    expect((await priceOf('OLD')).price).toBe(5); // no es del usuario
  });

  test('si el proveedor falla conserva el precio anterior (nunca escribe 0)', async () => {
    const user = await seedUserWithTickers(['BTC', 'AAPL']);
    fetchMock = installFetchMock([
      { match: /simple\/price/, status: 429, response: {} },
      { match: /twelvedata.com\/price/, response: { price: '0' } },
      { match: /quote\?symbol=EUR%2FUSD/, error: new Error('timeout') },
    ]);

    const result = await refreshAssetsForUsers({ userIds: [user.id], now: MARKET_OPEN });

    expect(result.updated).toBe(0);
    expect(result.failed).toBe(3);
    expect(result.failures.map((f) => f.ticker).sort()).toEqual(['AAPL', 'BTC', 'EURUSD']);
    expect((await priceOf('BTC')).price).toBe(60000);
    expect((await priceOf('AAPL')).price).toBe(100);
    expect((await priceOf('EURUSD')).price).toBe(1.05);
  });

  test('en modo cron omite acciones con mercado cerrado y assets inactivos', async () => {
    await seedUserWithTickers(['AAPL', 'OLD', 'BTC']);
    fetchMock = installFetchMock([
      { match: /simple\/price\?ids=bitcoin/, response: { bitcoin: { usd: 70000 } } },
      { match: /quote\?symbol=EUR%2FUSD/, response: { close: '1.1' } },
    ]);

    const result = await refreshAssetsForUsers({ isCronJob: true, now: MARKET_CLOSED });

    expect(result.marketStatus).toBe('Mercado US CERRADO');
    expect(result.total).toBe(2); // BTC + EURUSD
    expect(result.updated).toBe(2);
    expect(fetchMock.calls.some((c) => c.url.includes('twelvedata.com/price'))).toBe(false);
    expect((await priceOf('AAPL')).price).toBe(100);
    expect((await priceOf('OLD')).price).toBe(5);
    expect((await priceOf('BTC')).price).toBe(70000);
  });

  test('refresco manual actualiza acciones aunque el mercado esté cerrado', async () => {
    const user = await seedUserWithTickers(['AAPL']);
    fetchMock = installFetchMock([
      { match: /twelvedata.com\/price\?symbol=AAPL/, response: { price: '123' } },
      { match: /quote\?symbol=EUR%2FUSD/, response: { close: '1.1' } },
    ]);

    const result = await refreshAssetsForUsers({ userIds: [user.id], now: MARKET_CLOSED });
    expect(result.updated).toBe(2);
    expect((await priceOf('AAPL')).price).toBe(123);
  });

  test('sin usuarios o sin transacciones devuelve mensajes informativos', async () => {
    expect((await refreshAssetsForUsers({ isCronJob: true })).message).toBe('No hay usuarios en el sistema');
    const { user } = await createTestUser();
    expect((await refreshAssetsForUsers({ userIds: [user.id] })).message).toBe('No hay activos para actualizar');
    await expect(refreshAssetsForUsers({ userIds: [] })).rejects.toThrow('User ID requerido');
  });

  test('cron con solo acciones y mercado cerrado no llama a ningún proveedor', async () => {
    await seedUserWithTickers(['AAPL']);
    await query('DELETE FROM assets WHERE ticker = ?', ['EURUSD']);
    fetchMock = installFetchMock([]);

    const result = await refreshAssetsForUsers({ isCronJob: true, now: MARKET_CLOSED });
    expect(result.message).toBe('Mercado cerrado, no se actualizaron acciones');
    expect(result.skipped).toBe(1);
    expect(fetchMock.calls).toHaveLength(0);
  });
});
