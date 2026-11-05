import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { GET as getLeverage, POST as openPosition } from '@/app/api/leverage/route';
import { DELETE as deletePosition, GET as getPosition, PUT as updatePosition } from '@/app/api/leverage/[id]/route';
import { POST as closePosition } from '@/app/api/leverage/[id]/close/route';
import { GET as dashboardStats } from '@/app/api/dashboard/stats/route';
import { POST as snapshot } from '@/app/api/cronjobs/snapshot/route';
import { POST as refreshUser } from '@/app/api/assets/refresh-user/route';
import { createTestUser, query, resetDatabase, seedAssets } from '../helpers/db.js';
import { installFetchMock } from '../helpers/fetchMock.js';
import { call } from '../helpers/http.js';

let fetchMock;

beforeEach(async () => {
  await resetDatabase();
  await seedAssets([
    { ticker: 'TTWO', type: 'STOCK', currentPrice: 110, name: 'Take-Two' },
    { ticker: 'BTC', type: 'CRYPTO', currentPrice: 50000 },
    { ticker: 'EURUSD', type: 'FIAT', currentPrice: 1.25 },
  ]);
});
afterEach(() => fetchMock?.restore());

const openBody = (overrides = {}) => ({
  assetTicker: 'TTWO',
  assetType: 'STOCK',
  direction: 'LONG',
  margin: 1000,
  leverage: 5,
  entryPrice: 100,
  openFee: 5,
  spread: 0.1,
  dailySwap: 2,
  stopLoss: 92,
  takeProfit: 120,
  openedAt: '2026-01-01T10:00:00Z',
  ...overrides,
});

async function open(authHeaders, overrides) {
  return call(openPosition, '/api/leverage', { method: 'POST', headers: authHeaders, body: openBody(overrides) });
}

describe('POST /api/leverage', () => {
  test('requiere autenticación y valida el cuerpo', async () => {
    const { authHeaders } = await createTestUser();
    expect((await call(openPosition, '/api/leverage', { method: 'POST', body: openBody() })).status).toBe(401);

    const invalid = await open(authHeaders, { leverage: 0 });
    expect(invalid.status).toBe(400);
    expect(invalid.json.error).toMatch(/multiplicador/);

    const badStop = await open(authHeaders, { stopLoss: 150 });
    expect(badStop.status).toBe(400);
    expect(badStop.json.error).toMatch(/stop loss/i);
  });

  test('abre una posición calculando exposición, cantidad y precio de liquidación en el servidor', async () => {
    const { user, authHeaders } = await createTestUser();
    const { status, json } = await open(authHeaders, { exposure: 1, quantity: 1 });

    expect(status).toBe(201);
    expect(json.positionId).toBeGreaterThan(0);
    expect(json.position).toMatchObject({
      userId: user.id,
      assetTicker: 'TTWO',
      direction: 'LONG',
      margin: 1000,
      leverage: 5,
      exposure: 5000,
      entryPrice: 100,
      quantity: 50,
      openFee: 5,
      dailySwap: 2,
      stopLoss: 92,
      takeProfit: 120,
      status: 'OPEN',
      liquidationPrice: 90,
    });

    const [row] = await query('SELECT * FROM leveraged_positions');
    expect(Number(row.exposure)).toBe(5000);
    expect(Number(row.quantity)).toBe(50);
    expect(row.status).toBe('OPEN');
  });

  test('crea el asset si no existe, con el tipo indicado (índice y forex)', async () => {
    const { authHeaders } = await createTestUser();
    fetchMock = installFetchMock([
      { match: /quote\?symbol=SPX/, response: { name: 'S&P 500', close: '5000' } },
      { match: /quote\?symbol=GBP%2FUSD/, response: { close: '1.3' } },
    ]);

    const index = await open(authHeaders, { assetTicker: 'SPX', assetType: 'INDEX', entryPrice: 5000, stopLoss: null, takeProfit: null });
    expect(index.status).toBe(201);

    const forex = await open(authHeaders, { assetTicker: 'GBPUSD', assetType: 'FOREX', direction: 'SHORT', entryPrice: 1.3, stopLoss: 1.35, takeProfit: 1.2 });
    expect(forex.status).toBe(201);

    const assets = Object.fromEntries((await query('SELECT ticker, type, current_price FROM assets')).map((r) => [r.ticker, r]));
    expect(assets.SPX.type).toBe('INDEX');
    expect(Number(assets.SPX.current_price)).toBe(5000);
    expect(assets.GBPUSD.type).toBe('FIAT');
    expect(Number(assets.GBPUSD.current_price)).toBe(1.3);
  });
});

describe('GET /api/leverage', () => {
  test('devuelve resumen, abiertas valoradas a precio actual y cerradas', async () => {
    const { authHeaders } = await createTestUser();
    const first = await open(authHeaders);
    const second = await open(authHeaders, { direction: 'SHORT', margin: 500, leverage: 2, entryPrice: 100, stopLoss: 105, takeProfit: 80, openedAt: '2026-02-01T10:00:00Z' });

    await call(closePosition, `/api/leverage/${second.json.positionId}/close`, {
      method: 'POST',
      headers: authHeaders,
      body: { closePrice: 90, closeFee: 1, closedAt: '2026-02-03T10:00:00Z', reason: 'TAKE_PROFIT' },
    }, { id: String(second.json.positionId) });

    const { status, json } = await call(getLeverage, '/api/leverage', { headers: authHeaders });
    expect(status).toBe(200);
    expect(json.config.liquidationLevel).toBe(0.5);

    expect(json.openPositions).toHaveLength(1);
    const [openRow] = json.openPositions;
    expect(openRow).toMatchObject({ id: first.json.positionId, assetName: 'Take-Two', assetType: 'STOCK', currentPrice: 110, liquidationPrice: 90 });
    expect(openRow.evaluation.grossPnl).toBe(500);
    expect(openRow.evaluation.liquidationProximity).toBe(0);
    expect(openRow.evaluation.daysHeld).toBeGreaterThan(0);

    expect(json.closedPositions).toHaveLength(1);
    const [closedRow] = json.closedPositions;
    // corto 10 unidades (1000/100) de 100 a 90: +100 bruto; comisiones 5 + 1 + 2*2 = 10
    expect(closedRow).toMatchObject({ status: 'CLOSED', closeReason: 'TAKE_PROFIT', closePrice: 90, daysHeld: 2, grossPnl: 100, totalFees: 10, netPnl: 90, roi: 18 });
    expect(closedRow.closedAt).toBe('2026-02-03T10:00:00.000Z');

    expect(json.summary).toMatchObject({ openCount: 1, closedCount: 1, marginInvested: 1000, totalExposure: 5000, realizedNetPnl: 90, winningClosed: 1, winRate: 100 });
    expect(json.summary.unrealizedGrossPnl).toBe(500);
  });

  test('no mezcla posiciones de otros usuarios', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await open(a.authHeaders);

    const { json } = await call(getLeverage, '/api/leverage', { headers: b.authHeaders });
    expect(json.openPositions).toEqual([]);
    expect(json.summary.openCount).toBe(0);
  });
});

describe('/api/leverage/[id]', () => {
  test('GET, PUT y DELETE solo sobre posiciones propias', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const created = await open(a.authHeaders);
    const id = created.json.positionId;
    const params = { id: String(id) };

    expect((await call(getPosition, `/api/leverage/${id}`, { headers: b.authHeaders }, params)).status).toBe(404);
    expect((await call(getPosition, '/api/leverage/abc', { headers: a.authHeaders }, { id: 'abc' })).status).toBe(400);

    const detail = await call(getPosition, `/api/leverage/${id}`, { headers: a.authHeaders }, params);
    expect(detail.status).toBe(200);
    expect(detail.json.evaluation.grossPnl).toBe(500);

    const badUpdate = await call(updatePosition, `/api/leverage/${id}`, { method: 'PUT', headers: a.authHeaders, body: { takeProfit: 50 } }, params);
    expect(badUpdate.status).toBe(400);

    const badDate = await call(updatePosition, `/api/leverage/${id}`, { method: 'PUT', headers: a.authHeaders, body: { openedAt: 'ayer' } }, params);
    expect(badDate.json.error).toBe('Fecha de apertura inválida');

    const update = await call(updatePosition, `/api/leverage/${id}`, { method: 'PUT', headers: a.authHeaders, body: { stopLoss: null, takeProfit: 130, dailySwap: 3, notes: ' swing ', openedAt: '2025-12-20T08:30:00Z' } }, params);
    expect(update.status).toBe(200);
    const [row] = await query('SELECT stop_loss, take_profit, daily_swap, notes, opened_at FROM leveraged_positions WHERE id = ?', [id]);
    expect(row.stop_loss).toBeNull();
    expect(Number(row.take_profit)).toBe(130);
    expect(Number(row.daily_swap)).toBe(3);
    expect(row.notes).toBe('swing');
    expect(Number(row.opened_at) * 1000).toBe(new Date('2025-12-20T08:30:00Z').getTime());

    const afterEdit = await call(getPosition, `/api/leverage/${id}`, { headers: a.authHeaders }, params);
    expect(afterEdit.json.openedAt).toBe('2025-12-20T08:30:00.000Z');

    expect((await call(deletePosition, `/api/leverage/${id}`, { method: 'DELETE', headers: b.authHeaders }, params)).status).toBe(404);
    expect((await call(deletePosition, `/api/leverage/${id}`, { method: 'DELETE', headers: a.authHeaders }, params)).status).toBe(200);
    expect(await query('SELECT id FROM leveraged_positions')).toHaveLength(0);
  });
});

describe('POST /api/leverage/[id]/close', () => {
  test('cierre manual calcula días, comisiones, P&L neto y ROI', async () => {
    const { authHeaders } = await createTestUser();
    const { json: created } = await open(authHeaders);
    const params = { id: String(created.positionId) };

    const { status, json } = await call(closePosition, `/api/leverage/${created.positionId}/close`, {
      method: 'POST',
      headers: authHeaders,
      body: { closePrice: 110, closeFee: 3, closedAt: '2026-01-11T12:00:00Z' },
    }, params);

    expect(status).toBe(200);
    expect(json.position).toMatchObject({ status: 'CLOSED', closeReason: 'MANUAL', daysHeld: 10, swapTotal: 20, totalFees: 28, grossPnl: 500, netPnl: 472 });
    expect(json.position.roi).toBeCloseTo(47.2, 6);

    const again = await call(closePosition, `/api/leverage/${created.positionId}/close`, { method: 'POST', headers: authHeaders, body: { closePrice: 100 } }, params);
    expect(again.status).toBe(400);
    expect(again.json.error).toMatch(/ya está cerrada/);

    const edit = await call(updatePosition, `/api/leverage/${created.positionId}`, { method: 'PUT', headers: authHeaders, body: { notes: 'x' } }, params);
    expect(edit.status).toBe(400);
  });

  test('liquidación fija la pérdida en el 50 % de la garantía más comisiones', async () => {
    const { authHeaders } = await createTestUser();
    const { json: created } = await open(authHeaders);
    const params = { id: String(created.positionId) };

    const { status, json } = await call(closePosition, `/api/leverage/${created.positionId}/close`, {
      method: 'POST',
      headers: authHeaders,
      body: { reason: 'LIQUIDATION', closeFee: 4, closedAt: '2026-01-06T00:00:00Z' },
    }, params);

    expect(status).toBe(200);
    expect(json.position).toMatchObject({ closeReason: 'LIQUIDATION', closePrice: 90, daysHeld: 5, grossPnl: -500, totalFees: 19, netPnl: -519 });
  });

  test('valida precio, fecha y propiedad', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const { json: created } = await open(a.authHeaders);
    const params = { id: String(created.positionId) };
    const path = `/api/leverage/${created.positionId}/close`;

    expect((await call(closePosition, path, { method: 'POST', headers: a.authHeaders, body: {} }, params)).json.error).toMatch(/precio de cierre/);
    expect((await call(closePosition, path, { method: 'POST', headers: a.authHeaders, body: { closePrice: 100, reason: 'NOPE' } }, params)).json.error).toBe('Motivo de cierre inválido');
    expect((await call(closePosition, path, { method: 'POST', headers: a.authHeaders, body: { closePrice: 100, closedAt: '2025-12-01' } }, params)).json.error).toMatch(/anterior/);
    expect((await call(closePosition, path, { method: 'POST', headers: b.authHeaders, body: { closePrice: 100 } }, params)).status).toBe(404);
    expect((await call(closePosition, path, { method: 'POST', body: { closePrice: 100 } }, params)).status).toBe(401);
  });
});

describe('integración con el resto de la app', () => {
  test('el dashboard incluye el resumen apalancado en USD y EUR', async () => {
    const { authHeaders } = await createTestUser();
    await open(authHeaders);

    const { json } = await call(dashboardStats, '/api/dashboard/stats', { headers: authHeaders });
    expect(json.leverage.openCount).toBe(1);
    expect(json.leverage.marginInvested).toEqual({ usd: 1000, eur: 1000 / 1.25 });
    expect(json.leverage.totalExposure.usd).toBe(5000);
    expect(json.leverage.unrealizedNetPnl.usd).toBeLessThan(500); // 500 bruto menos comisiones devengadas
  });

  test('el cron de snapshots mantiene activos los tickers con posiciones apalancadas abiertas', async () => {
    const { authHeaders } = await createTestUser();
    await open(authHeaders);
    await query('UPDATE assets SET is_active = 0');

    const { json } = await call(snapshot, '/api/cronjobs/snapshot', { method: 'POST', headers: { Authorization: 'Bearer test-cron-secret' } });
    expect(json.success).toBe(true);
    const states = Object.fromEntries((await query('SELECT ticker, is_active FROM assets')).map((r) => [r.ticker, Number(r.is_active)]));
    expect(states).toEqual({ TTWO: 1, BTC: 0, EURUSD: 1 });
  });

  test('el refresco de precios del usuario incluye los activos apalancados', async () => {
    const { authHeaders } = await createTestUser();
    await open(authHeaders);
    fetchMock = installFetchMock([
      { match: /\/price\?symbol=TTWO/, response: { price: '115' } },
      { match: /quote\?symbol=EUR%2FUSD/, response: { close: '1.2' } },
    ]);

    const { status, json } = await call(refreshUser, '/api/assets/refresh-user', { method: 'POST', headers: authHeaders });
    expect(status).toBe(200);
    expect(json.updated).toBe(2);
    const [row] = await query("SELECT current_price FROM assets WHERE ticker = 'TTWO'");
    expect(Number(row.current_price)).toBe(115);
  });
});
