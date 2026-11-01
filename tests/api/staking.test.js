import { beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@/lib/db/index';
import { transactions } from '@/lib/db/schema';
import { GET as getStaking, POST as createPosition } from '@/app/api/staking/route';
import { POST as unstake } from '@/app/api/staking/[id]/route';
import { createTestUser, query, resetDatabase, seedAssets } from '../helpers/db.js';
import { call } from '../helpers/http.js';

beforeEach(async () => {
  await resetDatabase();
  await seedAssets([
    { ticker: 'ETH', type: 'CRYPTO', currentPrice: 2000, name: 'Ethereum' },
    { ticker: 'BTC', type: 'CRYPTO', currentPrice: 50000, name: 'Bitcoin' },
    { ticker: 'AAPL', type: 'STOCK', currentPrice: 100 },
  ]);
});

async function giveHoldings(userId, ticker, quantity) {
  await db.insert(transactions).values({
    userId,
    assetTicker: ticker,
    type: 'BUY',
    quantity,
    pricePerUnit: 1,
    fees: 0,
    date: new Date('2025-01-01'),
    createdAt: new Date(),
  });
}

const stakeBody = (overrides = {}) => ({ assetTicker: 'ETH', amountStaked: 2, manualApy: 10, lockPeriodDays: 3, startDate: '2026-01-01', ...overrides });

describe('POST /api/staking', () => {
  test('exige saldo disponible en cripto', async () => {
    const { user, authHeaders } = await createTestUser();

    const none = await call(createPosition, '/api/staking', { method: 'POST', headers: authHeaders, body: stakeBody() });
    expect(none.status).toBe(400);
    expect(none.json.error).toMatch(/No tienes balance/);

    await giveHoldings(user.id, 'ETH', 1);
    const tooMuch = await call(createPosition, '/api/staking', { method: 'POST', headers: authHeaders, body: stakeBody({ amountStaked: 2 }) });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.json.error).toMatch(/No puedes stakear más de/);

    const notCrypto = await call(createPosition, '/api/staking', { method: 'POST', headers: authHeaders, body: stakeBody({ assetTicker: 'AAPL' }) });
    expect(notCrypto.status).toBe(400);

    const unknown = await call(createPosition, '/api/staking', { method: 'POST', headers: authHeaders, body: stakeBody({ assetTicker: 'ZZZ' }) });
    expect(unknown.json.error).toBe('El activo no existe');

    expect((await call(createPosition, '/api/staking', { method: 'POST', body: stakeBody() })).status).toBe(401);
  });

  test('crea una posición y un segundo alta del mismo ticker se fusiona en la activa', async () => {
    const { user, authHeaders } = await createTestUser();
    await giveHoldings(user.id, 'ETH', 10);

    const first = await call(createPosition, '/api/staking', { method: 'POST', headers: authHeaders, body: stakeBody({ amountStaked: 2 }) });
    expect(first.status).toBe(201);
    expect(first.json.action).toBe('created');

    const second = await call(createPosition, '/api/staking', { method: 'POST', headers: authHeaders, body: stakeBody({ amountStaked: 3, startDate: '2026-02-01' }) });
    expect(second.status).toBe(201);
    expect(second.json.action).toBe('updated');
    expect(second.json.stakingPositionId).toBe(first.json.stakingPositionId);

    const positions = await query('SELECT * FROM staking_positions');
    expect(positions).toHaveLength(1);
    expect(Number(positions[0].amount_staked)).toBe(5);
    // 2 ETH al 10% durante 31 días
    expect(Number(positions[0].pending_reward_amount)).toBeCloseTo(2 * 0.1 * (31 / 365), 6);

    const events = await query('SELECT event_type, principal_amount, principal_after FROM staking_events ORDER BY id');
    expect(events.map((e) => e.event_type)).toEqual(['STAKE', 'STAKE']);
    expect(Number(events[1].principal_after)).toBe(5);
  });
});

describe('GET /api/staking', () => {
  test('resumen, posiciones enriquecidas, historial y criptos disponibles', async () => {
    const { user, authHeaders } = await createTestUser();
    await giveHoldings(user.id, 'ETH', 10);
    await giveHoldings(user.id, 'BTC', 0.5);
    await call(createPosition, '/api/staking', { method: 'POST', headers: authHeaders, body: stakeBody({ amountStaked: 4 }) });

    const { status, json } = await call(getStaking, '/api/staking', { headers: authHeaders });
    expect(status).toBe(200);

    expect(json.summary.totalCryptoUsdValue).toBe(10 * 2000 + 0.5 * 50000);
    expect(json.summary.totalStakedUsdValue).toBe(8000);
    expect(json.summary.stakedPercentage).toBeCloseTo((8000 / 45000) * 100, 9);
    expect(json.summary.ownedByTicker[0]).toMatchObject({ ticker: 'BTC', quantity: 0.5, usdValue: 25000 });
    expect(json.summary.stakedByTicker).toEqual([{ ticker: 'ETH', amountStaked: 4, currentPrice: 2000, usdValue: 8000 }]);

    expect(json.positions).toHaveLength(1);
    expect(json.positions[0]).toMatchObject({ assetTicker: 'ETH', assetName: 'Ethereum', currentPrice: 2000, amountStaked: 4 });
    expect(json.positions[0].projection.annual).toEqual({ coin: 0.4, usd: 800 });
    expect(json.positions[0].movements).toHaveLength(1);

    expect(json.history).toHaveLength(1);
    expect(json.history[0].eventType).toBe('STAKE');
    expect(json.availableCryptos.map((a) => a.ticker)).toEqual(['BTC', 'ETH']);
  });

  test('usuario sin datos devuelve estructuras vacías', async () => {
    const { authHeaders } = await createTestUser();
    const { json } = await call(getStaking, '/api/staking', { headers: authHeaders });
    expect(json.positions).toEqual([]);
    expect(json.summary.stakedPercentage).toBe(0);
  });
});

describe('POST /api/staking/[id] (unstake)', () => {
  async function setupPosition() {
    const { user, authHeaders } = await createTestUser();
    await giveHoldings(user.id, 'ETH', 10);
    const created = await call(createPosition, '/api/staking', { method: 'POST', headers: authHeaders, body: stakeBody({ amountStaked: 4 }) });
    return { user, authHeaders, positionId: created.json.stakingPositionId };
  }

  test('retirada parcial mantiene la posición y acumula recompensa pendiente', async () => {
    const { authHeaders, positionId } = await setupPosition();

    const { status, json } = await call(unstake, `/api/staking/${positionId}`, { method: 'POST', headers: authHeaders, body: { amountToUnstake: 1 } }, { id: String(positionId) });
    expect(status).toBe(200);
    expect(json).toMatchObject({ positionId, assetTicker: 'ETH', unstakedAmount: 1, remainingAmount: 3, isFullClose: false, rewardClaimed: 0 });
    expect(json.rewardAmount).toBeGreaterThan(0);
    expect(json.event).toBeUndefined();

    const [position] = await query('SELECT * FROM staking_positions WHERE id = ?', [positionId]);
    expect(Number(position.amount_staked)).toBe(3);
    expect(position.status).toBe('ACTIVE');
    expect(Number(position.pending_reward_amount)).toBeCloseTo(json.pendingRewardAfter, 8);

    const rewardTxs = await query('SELECT * FROM transactions WHERE price_per_unit = 0');
    expect(rewardTxs).toHaveLength(0);
  });

  test('cierre total reclama la recompensa como compra a coste 0 y cierra la posición', async () => {
    const { user, authHeaders, positionId } = await setupPosition();

    const { status, json } = await call(unstake, `/api/staking/${positionId}`, { method: 'POST', headers: authHeaders, body: { amountToUnstake: 4 } }, { id: String(positionId) });
    expect(status).toBe(200);
    expect(json.isFullClose).toBe(true);
    expect(json.rewardClaimed).toBeGreaterThan(0);
    expect(json.remainingAmount).toBe(0);

    const [position] = await query('SELECT * FROM staking_positions WHERE id = ?', [positionId]);
    expect(position.status).toBe('CLOSED');
    expect(Number(position.amount_staked)).toBe(0);
    expect(Number(position.total_claimed_reward)).toBeCloseTo(json.rewardClaimed, 8);
    expect(position.closed_at).not.toBeNull();

    const rewardTxs = await query('SELECT * FROM transactions WHERE price_per_unit = 0 AND user_id = ?', [user.id]);
    expect(rewardTxs).toHaveLength(1);
    expect(Number(rewardTxs[0].quantity)).toBeCloseTo(json.rewardClaimed, 8);
    expect(rewardTxs[0].type).toBe('BUY');

    const events = await query('SELECT event_type FROM staking_events WHERE staking_position_id = ? ORDER BY id', [positionId]);
    expect(events.map((e) => e.event_type)).toEqual(['STAKE', 'CLOSE']);

    // La posición cerrada ya no aparece en el listado
    const list = await call(getStaking, '/api/staking', { headers: authHeaders });
    expect(list.json.positions).toHaveLength(0);
    expect(list.json.history).toHaveLength(2);
  });

  test('validaciones: cantidad, exceso, propiedad e id', async () => {
    const { authHeaders, positionId } = await setupPosition();
    const other = await createTestUser();
    const params = { id: String(positionId) };

    expect((await call(unstake, `/api/staking/${positionId}`, { method: 'POST', headers: authHeaders, body: { amountToUnstake: 0 } }, params)).status).toBe(400);

    const tooMuch = await call(unstake, `/api/staking/${positionId}`, { method: 'POST', headers: authHeaders, body: { amountToUnstake: 99 } }, params);
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.json.error).toMatch(/No puedes retirar más/);

    expect((await call(unstake, `/api/staking/${positionId}`, { method: 'POST', headers: other.authHeaders, body: { amountToUnstake: 1 } }, params)).status).toBe(404);
    expect((await call(unstake, '/api/staking/abc', { method: 'POST', headers: authHeaders, body: { amountToUnstake: 1 } }, { id: 'abc' })).status).toBe(400);

    // Nada cambió
    const [position] = await query('SELECT amount_staked FROM staking_positions WHERE id = ?', [positionId]);
    expect(Number(position.amount_staked)).toBe(4);
  });
});
