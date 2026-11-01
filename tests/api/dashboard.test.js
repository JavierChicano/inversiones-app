import { beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@/lib/db/index';
import { portfolioSnapshots, transactions } from '@/lib/db/schema';
import { GET as dashboardStats } from '@/app/api/dashboard/stats/route';
import { GET as closedPositions } from '@/app/api/analytics/closed-positions/route';
import { GET as contributions } from '@/app/api/profile/contributions/route';
import { POST as createExchange } from '@/app/api/currency-exchanges/route';
import { createTestUser, resetDatabase, seedAssets } from '../helpers/db.js';
import { call } from '../helpers/http.js';

beforeEach(async () => {
  await resetDatabase();
  await seedAssets([
    { ticker: 'AAPL', type: 'STOCK', currentPrice: 110 },
    { ticker: 'BTC', type: 'CRYPTO', currentPrice: 50000 },
    { ticker: 'EURUSD', type: 'FIAT', currentPrice: 1.1 },
  ]);
});

async function seedPortfolio(userId) {
  await db.insert(transactions).values([
    { userId, assetTicker: 'AAPL', type: 'BUY', quantity: 10, pricePerUnit: 100, fees: 10, date: new Date('2024-01-01'), createdAt: new Date() },
    { userId, assetTicker: 'AAPL', type: 'BUY', quantity: 10, pricePerUnit: 80, fees: 0, date: new Date('2024-02-01'), createdAt: new Date() },
    { userId, assetTicker: 'AAPL', type: 'SELL', quantity: 5, pricePerUnit: 120, fees: 5, date: new Date('2024-03-01'), createdAt: new Date() },
    { userId, assetTicker: 'BTC', type: 'BUY', quantity: 0.5, pricePerUnit: 40000, fees: 0, date: new Date('2024-01-15'), createdAt: new Date() },
  ]);
}

describe('GET /api/dashboard/stats', () => {
  test('requiere autenticación', async () => {
    expect((await call(dashboardStats, '/api/dashboard/stats')).status).toBe(401);
  });

  test('calcula estadísticas en USD y EUR con el motor de cartera', async () => {
    const { user, authHeaders } = await createTestUser();
    await seedPortfolio(user.id);

    const { status, json } = await call(dashboardStats, '/api/dashboard/stats', { headers: authHeaders });
    expect(status).toBe(200);

    expect(json.exchangeRate.eurUsd).toBe(1.1);
    expect(json.stats.netTotal.usd).toBe(195);
    expect(json.stats.netTotal.eur).toBeCloseTo(195 / 1.1, 9);
    expect(json.stats.invested.usd).toBe(21410);
    expect(json.stats.portfolioTotal.usd).toBe(26650);
    expect(json.stats.roi).toBeCloseTo(((26650 - 21410) / 21410) * 100, 9);
    expect(json.stats.winRate).toBe(100);
    expect(json.stats.totalFees).toBe(15);
    expect(json.stats.closedPositions).toBe(1);

    expect(json.stockDistribution.map((p) => p.ticker)).toEqual(['BTC', 'AAPL']);
    expect(json.stockDistribution[1]).toMatchObject({ quantity: 15, avgBuyPrice: 94, currentPrice: 110, type: 'STOCK' });
    expect(json.stockDistribution[1].openLots).toHaveLength(2);

    // Sin snapshots se genera un punto con los datos actuales
    expect(json.progression).toHaveLength(1);
    expect(json.progression[0]).toMatchObject({ value: 26650, invested: 21410 });
    expect(json.transactions).toHaveLength(4);
    expect(json.transactions[0].ticker).toBe('AAPL'); // cronológico
    expect(json.progressionMeta.snapshotsQueried).toBe(0);
  });

  test('devuelve la progresión de snapshots filtrada, muestreada y en orden cronológico', async () => {
    const { user, authHeaders } = await createTestUser();
    await seedPortfolio(user.id);
    await db.insert(portfolioSnapshots).values(
      Array.from({ length: 30 }, (_, i) => ({
        userId: user.id,
        date: new Date(Date.UTC(2026, 0, 1 + i)),
        totalInvested: 1000,
        totalValue: 1000 + i,
      }))
    );

    const { json } = await call(dashboardStats, '/api/dashboard/stats?startDate=2026-01-05T00:00:00Z&endDate=2026-01-20T00:00:00Z&maxSnapshots=5&onlyProgression=1', { headers: authHeaders });

    expect(json.stats).toBeUndefined();
    expect(json.progressionMeta.snapshotsQueried).toBe(16);
    expect(json.progression).toHaveLength(5);
    expect(json.progression[0].value).toBe(1004);
    expect(json.progression[4].value).toBe(1019);
    expect(json.progression[0].netGain).toBe(4);
    expect(json.transactions).toHaveLength(0); // ninguna transacción en 2026

    const sampled = await call(dashboardStats, '/api/dashboard/stats?sampleEvery=10', { headers: authHeaders });
    expect(sampled.json.progression.map((p) => p.value)).toEqual([1000, 1010, 1020, 1029]);
  });

  test('usuario sin transacciones devuelve ceros sin errores', async () => {
    const { authHeaders } = await createTestUser();
    const { status, json } = await call(dashboardStats, '/api/dashboard/stats', { headers: authHeaders });
    expect(status).toBe(200);
    expect(json.stats.portfolioTotal).toEqual({ usd: 0, eur: 0 });
    expect(json.stockDistribution).toEqual([]);
  });
});

describe('GET /api/analytics/closed-positions', () => {
  test('convierte a EUR y devuelve métricas globales', async () => {
    const { user, authHeaders } = await createTestUser();
    await seedPortfolio(user.id);

    const { status, json } = await call(closedPositions, '/api/analytics/closed-positions', { headers: authHeaders });
    expect(status).toBe(200);
    expect(json.closedPositions).toHaveLength(1);

    const aapl = json.closedPositions[0];
    expect(aapl.ticker).toBe('AAPL');
    expect(aapl.totalTrades).toBe(1);
    expect(aapl.totalGainLoss).toBeCloseTo(195 / 1.1, 9);
    expect(aapl.totalInvested).toBeCloseTo(400 / 1.1, 9);
    expect(aapl.roi).toBeCloseTo(48.75, 9);
    expect(aapl.trades[0].gainLoss).toBeCloseTo(195 / 1.1, 9);
    expect(aapl.trades[0].holdingDays).toBe(29);

    expect(json.metrics).toMatchObject({ totalTrades: 1, totalGainLoss: 195, totalInvested: 400, winningTrades: 1, losingTrades: 0, totalTickers: 1, winRate: 100 });
    expect(json.metrics.totalGainLossEur).toBeCloseTo(195 / 1.1, 9);
    expect(json.progression).toEqual([expect.objectContaining({ ticker: 'AAPL', gainLoss: 195, cumulativeGain: 195 })]);
    expect(json.exchangeRate.eurUsd).toBe(1.1);
  });

  test('sin ventas devuelve listas vacías', async () => {
    const { authHeaders } = await createTestUser();
    const { json } = await call(closedPositions, '/api/analytics/closed-positions', { headers: authHeaders });
    expect(json.closedPositions).toEqual([]);
    expect(json.metrics.totalTrades).toBe(0);
    expect((await call(closedPositions, '/api/analytics/closed-positions')).status).toBe(401);
  });
});

describe('GET /api/profile/contributions', () => {
  test('usa los cambios de divisa cuando existen', async () => {
    const { authHeaders } = await createTestUser();
    await call(createExchange, '/api/currency-exchanges', { method: 'POST', headers: authHeaders, body: { fromCurrency: 'EUR', toCurrency: 'USD', amount: 500, exchangeRate: 1.1, date: new Date().toISOString() } });

    const { status, json } = await call(contributions, '/api/profile/contributions', { headers: authHeaders });
    expect(status).toBe(200);
    expect(json.source).toBe('exchanges');
    expect(json.months).toHaveLength(1);
    expect(json.metrics.totalContributedEur).toBe(500);
    expect(json.metrics.currentStreak).toBe(1);
  });

  test('sin cambios de divisa aproxima con las transacciones', async () => {
    const { user, authHeaders } = await createTestUser();
    await db.insert(transactions).values({ userId: user.id, assetTicker: 'AAPL', type: 'BUY', quantity: 1, pricePerUnit: 110, fees: 0, date: new Date(), createdAt: new Date() });

    const { json } = await call(contributions, '/api/profile/contributions', { headers: authHeaders });
    expect(json.source).toBe('transactions');
    expect(json.metrics.totalContributedEur).toBeCloseTo(100, 9); // 110 USD / 1.1
  });

  test('sin datos devuelve métricas vacías', async () => {
    const { authHeaders } = await createTestUser();
    const { json } = await call(contributions, '/api/profile/contributions', { headers: authHeaders });
    expect(json.months).toEqual([]);
    expect(json.metrics.monthsTotal).toBe(0);
  });
});
