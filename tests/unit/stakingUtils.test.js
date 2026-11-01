import { describe, expect, test } from 'bun:test';
import {
  calculateAccruedStakingReward,
  calculateStakingProjection,
  getStakingSummary,
} from '@/lib/utils/staking.utils';

describe('calculateStakingProjection', () => {
  test('proyección anual, mensual y diaria en coin y USD', () => {
    const projection = calculateStakingProjection(100, 10, 2);
    expect(projection.annual).toEqual({ coin: 10, usd: 20 });
    expect(projection.monthly.coin).toBeCloseTo(10 / 12, 12);
    expect(projection.daily.usd).toBeCloseTo(20 / 365, 12);
  });

  test('valores inválidos se tratan como 0', () => {
    expect(calculateStakingProjection('x', null, undefined).annual).toEqual({ coin: 0, usd: 0 });
  });
});

describe('calculateAccruedStakingReward', () => {
  test('acumula proporcionalmente a los días transcurridos', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-01T00:00:00Z');
    to.setUTCDate(to.getUTCDate() + 73); // 73 días = 1/5 de año
    const accrued = calculateAccruedStakingReward(100, 10, from, to);
    expect(accrued.coin).toBeCloseTo(2, 12); // 100 * 10% * 73/365
    expect(accrued.days).toBe(73);
    expect(accrued.periodStart).toEqual(from);
  });

  test('sin fecha de inicio, cantidad 0 o fechas inválidas devuelve 0', () => {
    expect(calculateAccruedStakingReward(100, 10, null).coin).toBe(0);
    expect(calculateAccruedStakingReward(0, 10, '2026-01-01', '2026-02-01').coin).toBe(0);
    expect(calculateAccruedStakingReward(100, 10, 'x', '2026-02-01').coin).toBe(0);
  });

  test('un periodo negativo no genera recompensa', () => {
    const result = calculateAccruedStakingReward(100, 10, '2026-02-01', '2026-01-01');
    expect(result.coin).toBe(0);
    expect(result.days).toBe(0);
  });
});

describe('getStakingSummary', () => {
  test('porcentaje stakeado', () => {
    expect(getStakingSummary({ totalCryptoOwned: 200, totalStaked: 50 })).toEqual({
      totalCryptoOwned: 200,
      totalStaked: 50,
      stakedPercentage: 25,
    });
    expect(getStakingSummary({}).stakedPercentage).toBe(0);
  });
});
