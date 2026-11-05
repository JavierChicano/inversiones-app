import { describe, expect, test } from 'bun:test';
import {
  LIQUIDATION_LEVEL,
  calculateDaysHeld,
  calculateExposure,
  calculateGrossPnl,
  calculateLiquidationPrice,
  calculateLiquidationProximity,
  calculateQuantity,
  calculateRoi,
  calculateTotalFees,
  enrichLeveragedPositions,
  evaluateOpenPosition,
  settleLeveragedPosition,
  summarizeLeveragedPositions,
} from '@/lib/utils/leverage';

// Ejemplo base: 1.000 USD de garantía x5 sobre un activo a 100 USD → exposición 5.000, 50 unidades
const longPosition = {
  direction: 'LONG',
  margin: 1000,
  leverage: 5,
  exposure: 5000,
  entryPrice: 100,
  quantity: 50,
  openFee: 5,
  dailySwap: 2,
  openedAt: new Date('2026-01-01T10:00:00Z'),
  status: 'OPEN',
};
const shortPosition = { ...longPosition, direction: 'SHORT' };

describe('exposición y cantidad', () => {
  test('exposición = garantía × multiplicador; cantidad = exposición / precio', () => {
    expect(calculateExposure(1000, 5)).toBe(5000);
    expect(calculateQuantity(5000, 100)).toBe(50);
    expect(calculateQuantity(5000, 0)).toBe(0);
    expect(calculateExposure('x', 5)).toBe(0);
  });
});

describe('P&L bruto según dirección', () => {
  test('largo gana si sube, corto gana si baja', () => {
    expect(calculateGrossPnl(longPosition, 110)).toBe(500);
    expect(calculateGrossPnl(longPosition, 90)).toBe(-500);
    expect(calculateGrossPnl(shortPosition, 110)).toBe(-500);
    expect(calculateGrossPnl(shortPosition, 90)).toBe(500);
  });
});

describe('precio de liquidación al 50 % de la garantía', () => {
  test('largo: entrada − 0,5·G/cantidad; corto: entrada + 0,5·G/cantidad', () => {
    expect(LIQUIDATION_LEVEL).toBe(0.5);
    expect(calculateLiquidationPrice(longPosition)).toBe(90); // 100 - 500/50
    expect(calculateLiquidationPrice(shortPosition)).toBe(110);
    // En el precio de liquidación la pérdida bruta es exactamente el 50 % de la garantía
    expect(calculateGrossPnl(longPosition, 90)).toBe(-0.5 * longPosition.margin);
    expect(calculateGrossPnl(shortPosition, 110)).toBe(-0.5 * shortPosition.margin);
  });

  test('x1 en largo no puede bajar de 0 y sin cantidad devuelve 0', () => {
    const x1 = { direction: 'LONG', margin: 100, entryPrice: 10, quantity: 10 };
    expect(calculateLiquidationPrice(x1)).toBe(5);
    expect(calculateLiquidationPrice({ ...x1, quantity: 0 })).toBe(0);
    expect(calculateLiquidationPrice({ direction: 'LONG', margin: 1000, entryPrice: 1, quantity: 1 })).toBe(0);
  });

  test('proximidad a liquidación: 0 % en beneficio, 100 % al tocar el nivel', () => {
    expect(calculateLiquidationProximity(longPosition, 105)).toBe(0);
    expect(calculateLiquidationProximity(longPosition, 95)).toBe(50);
    expect(calculateLiquidationProximity(longPosition, 85)).toBe(100);
    expect(calculateLiquidationProximity(shortPosition, 107.5)).toBe(75);
    expect(calculateLiquidationProximity(shortPosition, 95)).toBe(0);
    expect(calculateLiquidationProximity(longPosition, 0)).toBeNull();
  });
});

describe('días mantenida y comisiones', () => {
  test('cuenta noches (cambios de día UTC)', () => {
    expect(calculateDaysHeld('2026-01-01T10:00:00Z', '2026-01-01T18:00:00Z')).toBe(0);
    expect(calculateDaysHeld('2026-01-01T23:00:00Z', '2026-01-02T01:00:00Z')).toBe(1);
    expect(calculateDaysHeld('2026-01-01T10:00:00Z', '2026-01-11T09:00:00Z')).toBe(10);
    expect(calculateDaysHeld('2026-01-11', '2026-01-01')).toBe(0);
    expect(calculateDaysHeld(null, '2026-01-01')).toBe(0);
  });

  test('comisiones totales = apertura + cierre + swap × días', () => {
    expect(calculateTotalFees({ openFee: 5, closeFee: 3, dailySwap: 2 }, 10)).toBe(28);
    expect(calculateTotalFees({}, 10)).toBe(0);
    expect(calculateTotalFees({ dailySwap: 2 }, -3)).toBe(0);
  });

  test('ROI neto sobre la garantía', () => {
    expect(calculateRoi(250, 1000)).toBe(25);
    expect(calculateRoi(-500, 1000)).toBe(-50);
    expect(calculateRoi(100, 0)).toBe(0);
  });
});

describe('settleLeveragedPosition', () => {
  test('cierre manual en largo con beneficio', () => {
    const result = settleLeveragedPosition(longPosition, {
      closePrice: 110,
      closeFee: 3,
      closedAt: new Date('2026-01-11T12:00:00Z'),
      reason: 'MANUAL',
    });

    expect(result).toMatchObject({ status: 'CLOSED', closeReason: 'MANUAL', closePrice: 110, closeFee: 3, daysHeld: 10 });
    expect(result.swapTotal).toBe(20);
    expect(result.totalFees).toBe(28); // 5 + 3 + 2*10
    expect(result.grossPnl).toBe(500);
    expect(result.netPnl).toBe(472);
    expect(result.roi).toBeCloseTo(47.2, 6);
    expect(result.closedAt.toISOString()).toBe('2026-01-11T12:00:00.000Z');
  });

  test('cierre de un corto por stop loss con pérdida', () => {
    const result = settleLeveragedPosition(shortPosition, { closePrice: 104, closeFee: 1, closedAt: '2026-01-03T00:00:00Z', reason: 'STOP_LOSS' });
    expect(result.grossPnl).toBe(-200);
    expect(result.totalFees).toBe(10); // 5 + 1 + 2*2
    expect(result.netPnl).toBe(-210);
    expect(result.roi).toBe(-21);
  });

  test('liquidación fija la pérdida en el 50 % de la garantía más comisiones y usa el precio de liquidación', () => {
    const result = settleLeveragedPosition(longPosition, { closeFee: 4, closedAt: '2026-01-06T00:00:00Z', reason: 'LIQUIDATION' });
    expect(result.closeReason).toBe('LIQUIDATION');
    expect(result.closePrice).toBe(90);
    expect(result.daysHeld).toBe(5);
    expect(result.grossPnl).toBe(-500);
    expect(result.totalFees).toBe(19); // 5 + 4 + 2*5
    expect(result.netPnl).toBe(-519);
    expect(result.roi).toBeCloseTo(-51.9, 6);

    // Si el bróker informa de un precio de ejecución distinto, se respeta pero la pérdida bruta sigue fija
    const withPrice = settleLeveragedPosition(longPosition, { closePrice: 89.5, reason: 'LIQUIDATION', closedAt: '2026-01-01T12:00:00Z' });
    expect(withPrice.closePrice).toBe(89.5);
    expect(withPrice.grossPnl).toBe(-500);
  });

  test('motivo desconocido se trata como cierre manual', () => {
    expect(settleLeveragedPosition(longPosition, { closePrice: 100, reason: 'X', closedAt: '2026-01-01T12:00:00Z' }).closeReason).toBe('MANUAL');
  });
});

describe('evaluateOpenPosition', () => {
  test('valora la posición a precio actual con swap devengado', () => {
    const now = new Date('2026-01-04T12:00:00Z');
    const evaluation = evaluateOpenPosition(longPosition, { currentPrice: 95, now });

    expect(evaluation).toMatchObject({ currentPrice: 95, hasPrice: true, daysHeld: 3, swapAccrued: 6, feesAccrued: 11 });
    expect(evaluation.grossPnl).toBe(-250);
    expect(evaluation.netPnl).toBe(-261);
    expect(evaluation.roi).toBeCloseTo(-26.1, 6);
    expect(evaluation.liquidationPrice).toBe(90);
    expect(evaluation.liquidationProximity).toBe(50);
    expect(evaluation.priceChangePercent).toBe(-5);
    expect(evaluation.equity).toBe(739);
  });

  test('sin precio solo refleja las comisiones devengadas', () => {
    const evaluation = evaluateOpenPosition(longPosition, { currentPrice: 0, now: new Date('2026-01-02T00:00:00Z') });
    expect(evaluation.hasPrice).toBe(false);
    expect(evaluation.grossPnl).toBe(0);
    expect(evaluation.netPnl).toBe(-7);
    expect(evaluation.liquidationProximity).toBeNull();
  });
});

describe('summarizeLeveragedPositions y enrichLeveragedPositions', () => {
  test('agrega garantía, exposición, P&L latente y realizado', () => {
    const assetMap = new Map([['AAA', { name: 'Triple A', type: 'STOCK', currentPrice: 95 }]]);
    const closed = {
      ...longPosition,
      assetTicker: 'AAA',
      id: 2,
      status: 'CLOSED',
      closedAt: new Date('2026-01-11T00:00:00Z'),
      closeReason: 'LIQUIDATION',
      grossPnl: -500,
      netPnl: -519,
      totalFees: 19,
    };
    const winner = { ...closed, id: 3, closeReason: 'MANUAL', grossPnl: 500, netPnl: 472, totalFees: 28 };
    const now = new Date('2026-01-04T12:00:00Z');

    const { openPositions, closedPositions } = enrichLeveragedPositions(
      [{ ...longPosition, assetTicker: 'AAA', id: 1 }, closed, winner],
      assetMap,
      now
    );

    expect(openPositions).toHaveLength(1);
    expect(openPositions[0]).toMatchObject({ assetName: 'Triple A', currentPrice: 95, liquidationPrice: 90, openedAt: '2026-01-01T10:00:00.000Z' });
    expect(openPositions[0].evaluation.netPnl).toBe(-261);
    expect(closedPositions).toHaveLength(2);
    expect(closedPositions[0].closedAt).toBe('2026-01-11T00:00:00.000Z');

    const summary = summarizeLeveragedPositions(openPositions, closedPositions);
    expect(summary).toMatchObject({
      openCount: 1,
      closedCount: 2,
      marginInvested: 1000,
      totalExposure: 5000,
      unrealizedGrossPnl: -250,
      unrealizedNetPnl: -261,
      swapAccrued: 6,
      realizedGrossPnl: 0,
      realizedNetPnl: -47,
      realizedFees: 47,
      winningClosed: 1,
      liquidations: 1,
      maxLiquidationProximity: 50,
      positionsAtRisk: 0,
      winRate: 50,
    });
    expect(summary.unrealizedRoi).toBeCloseTo(-26.1, 6);
  });

  test('sin posiciones devuelve ceros', () => {
    const summary = summarizeLeveragedPositions([], []);
    expect(summary.openCount).toBe(0);
    expect(summary.winRate).toBe(0);
    expect(summary.unrealizedRoi).toBe(0);
  });
});
