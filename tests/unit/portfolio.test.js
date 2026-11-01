import { describe, expect, test } from 'bun:test';
import {
  buildDashboardStats,
  buildHoldings,
  buildPortfolio,
  daysBetween,
  sampleSeries,
  sortTransactionsChronologically,
  summarizeClosedPositions,
  summarizeOpenPositions,
} from '@/lib/utils/portfolio';

const tx = (overrides) => ({
  id: 1,
  assetTicker: 'AAPL',
  type: 'BUY',
  quantity: 1,
  pricePerUnit: 100,
  fees: 0,
  date: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

describe('sortTransactionsChronologically', () => {
  test('ordena por fecha y, a igual fecha, por id ascendente', () => {
    const list = [
      tx({ id: 3, date: '2024-02-01' }),
      tx({ id: 2, date: '2024-01-01' }),
      tx({ id: 1, date: '2024-02-01' }),
    ];
    expect(sortTransactionsChronologically(list).map((t) => t.id)).toEqual([2, 1, 3]);
  });

  test('no muta el array original', () => {
    const list = [tx({ id: 2, date: '2024-02-01' }), tx({ id: 1, date: '2024-01-01' })];
    sortTransactionsChronologically(list);
    expect(list[0].id).toBe(2);
  });
});

describe('daysBetween', () => {
  test('cuenta días completos y nunca es negativo', () => {
    expect(daysBetween('2024-01-01', '2024-01-31')).toBe(30);
    expect(daysBetween('2024-01-31', '2024-01-01')).toBe(0);
    expect(daysBetween('2024-01-01T00:00:00Z', '2024-01-01T23:59:59Z')).toBe(0);
  });
});

describe('buildPortfolio', () => {
  test('vende primero el lote más barato y prorratea comisiones', () => {
    const transactions = [
      tx({ id: 1, quantity: 10, pricePerUnit: 100, fees: 10, date: '2024-01-01' }),
      tx({ id: 2, quantity: 10, pricePerUnit: 80, fees: 0, date: '2024-02-01' }),
      tx({ id: 3, type: 'SELL', quantity: 5, pricePerUnit: 120, fees: 5, date: '2024-03-01' }),
    ];

    const portfolio = buildPortfolio(transactions);
    const position = portfolio.positions.get('AAPL');

    // La venta consume el lote a 80 (más barato): coste 400, ingreso 5*120-5 = 595
    expect(portfolio.realizedTrades).toHaveLength(1);
    const trade = portfolio.realizedTrades[0];
    expect(trade.invested).toBe(400);
    expect(trade.revenue).toBe(595);
    expect(trade.gainLoss).toBe(195);
    expect(trade.holdingDays).toBe(29);
    expect(trade.roi).toBeCloseTo(48.75, 5);
    expect(trade.cumulativeGain).toBe(195);

    expect(position.lots).toHaveLength(2);
    expect(position.lots[0]).toMatchObject({ quantity: 10, pricePerUnit: 100, fees: 10 });
    expect(position.lots[1]).toMatchObject({ quantity: 5, originalQuantity: 10, pricePerUnit: 80 });
    expect(position.winningTrades).toBe(1);
    expect(position.losingTrades).toBe(0);

    expect(portfolio.totals).toEqual({
      totalInvested: 1810,
      totalFees: 15,
      totalSellProceeds: 595,
      realizedGainLoss: 195,
      closedPositions: 1,
    });
  });

  test('prorratea la comisión de compra según la fracción vendida', () => {
    const portfolio = buildPortfolio([
      tx({ id: 1, quantity: 10, pricePerUnit: 100, fees: 20, date: '2024-01-01' }),
      tx({ id: 2, type: 'SELL', quantity: 4, pricePerUnit: 100, fees: 0, date: '2024-01-10' }),
    ]);

    const [trade] = portfolio.realizedTrades;
    expect(trade.invested).toBe(408); // 400 + 20 * 4/10
    expect(trade.gainLoss).toBe(-8);
    expect(portfolio.positions.get('AAPL').losingTrades).toBe(1);
  });

  test('a igual precio consume primero el lote más antiguo (FIFO)', () => {
    const portfolio = buildPortfolio([
      tx({ id: 1, quantity: 5, pricePerUnit: 50, date: '2024-01-01' }),
      tx({ id: 2, quantity: 5, pricePerUnit: 50, date: '2024-02-01' }),
      tx({ id: 3, type: 'SELL', quantity: 5, pricePerUnit: 60, date: '2024-03-01' }),
    ]);

    const lots = portfolio.positions.get('AAPL').lots;
    expect(lots).toHaveLength(1);
    expect(new Date(lots[0].date).toISOString()).toBe(new Date('2024-02-01').toISOString());
    expect(portfolio.realizedTrades[0].holdingDays).toBe(60);
  });

  test('vender más de lo que hay solo computa la parte cubierta', () => {
    const portfolio = buildPortfolio([
      tx({ id: 1, quantity: 5, pricePerUnit: 10, date: '2024-01-01' }),
      tx({ id: 2, type: 'SELL', quantity: 8, pricePerUnit: 20, fees: 0, date: '2024-02-01' }),
    ]);

    const [trade] = portfolio.realizedTrades;
    expect(trade.quantity).toBe(5);
    expect(trade.revenue).toBe(100); // 160 * 5/8
    expect(trade.invested).toBe(50);
    expect(trade.gainLoss).toBe(50);
    expect(portfolio.positions.get('AAPL').lots).toHaveLength(0);
  });

  test('ignora tipos desconocidos y maneja cantidades no numéricas', () => {
    const portfolio = buildPortfolio([
      tx({ id: 1, type: 'DIVIDEND', quantity: 5 }),
      tx({ id: 2, quantity: 'abc', pricePerUnit: null }),
    ]);
    expect(portfolio.totals.totalInvested).toBe(0);
    expect(portfolio.positions.get('AAPL').lots).toHaveLength(1);
  });

  test('procesa en orden cronológico aunque lleguen desordenadas', () => {
    const portfolio = buildPortfolio([
      tx({ id: 2, type: 'SELL', quantity: 1, pricePerUnit: 200, date: '2024-05-01' }),
      tx({ id: 1, quantity: 1, pricePerUnit: 100, date: '2024-01-01' }),
    ]);
    expect(portfolio.totals.realizedGainLoss).toBe(100);
  });
});

describe('summarizeOpenPositions / buildDashboardStats', () => {
  const transactions = [
    tx({ id: 1, quantity: 10, pricePerUnit: 100, fees: 10, date: '2024-01-01' }),
    tx({ id: 2, quantity: 10, pricePerUnit: 80, fees: 0, date: '2024-02-01' }),
    tx({ id: 3, type: 'SELL', quantity: 5, pricePerUnit: 120, fees: 5, date: '2024-03-01' }),
    tx({ id: 4, assetTicker: 'BTC', quantity: 0.5, pricePerUnit: 40000, fees: 0, date: '2024-01-15' }),
  ];
  const now = new Date('2024-04-01T00:00:00Z');
  const priceMap = { AAPL: 110, BTC: 50000 };
  const typeMap = { AAPL: 'STOCK', BTC: 'CRYPTO' };

  test('valora las posiciones abiertas a precio actual', () => {
    const { stockDistribution, totalCurrentValue, currentInvested } = summarizeOpenPositions(
      buildPortfolio(transactions),
      { priceMap, typeMap, now }
    );

    const aapl = stockDistribution.find((p) => p.ticker === 'AAPL');
    const btc = stockDistribution.find((p) => p.ticker === 'BTC');

    expect(aapl.quantity).toBe(15);
    expect(aapl.currentValue).toBe(1650);
    expect(aapl.avgBuyPrice).toBe(94); // 1410 / 15
    expect(aapl.gainLoss).toBe(240);
    expect(aapl.gainLossPercent).toBeCloseTo((240 / 1410) * 100, 6);
    expect(aapl.avgHoldingDays).toBe(91); // desde el lote más antiguo (2024-01-01)
    expect(aapl.openLots).toHaveLength(2);
    expect(aapl.openLots[0].pricePerUnit).toBe(80); // más reciente primero
    expect(aapl.openLots[1].invested).toBe(1010);
    expect(aapl.type).toBe('STOCK');

    expect(btc.currentValue).toBe(25000);
    expect(btc.type).toBe('CRYPTO');

    expect(totalCurrentValue).toBe(26650);
    expect(currentInvested).toBe(21410);
    expect(stockDistribution[0].ticker).toBe('BTC'); // mayor porcentaje primero
    expect(stockDistribution[0].percentage + stockDistribution[1].percentage).toBeCloseTo(100, 9);
  });

  test('posiciones totalmente vendidas no aparecen', () => {
    const { stockDistribution } = summarizeOpenPositions(
      buildPortfolio([
        tx({ id: 1, quantity: 1, pricePerUnit: 10, date: '2024-01-01' }),
        tx({ id: 2, type: 'SELL', quantity: 1, pricePerUnit: 12, date: '2024-01-02' }),
      ]),
      { priceMap: { AAPL: 15 }, now }
    );
    expect(stockDistribution).toHaveLength(0);
  });

  test('buildDashboardStats agrega las métricas del dashboard', () => {
    const { stats } = buildDashboardStats(buildPortfolio(transactions), { priceMap, typeMap, now });

    expect(stats.netTotal).toBe(195);
    expect(stats.invested).toBe(21410);
    expect(stats.portfolioTotal).toBe(26650);
    expect(stats.roi).toBeCloseTo(((26650 - 21410) / 21410) * 100, 9);
    expect(stats.gainPercent).toBe(stats.roi);
    expect(stats.winRate).toBe(100);
    expect(stats.totalFees).toBe(15);
    expect(stats.closedPositions).toBe(1);
    expect(stats.avgGain).toBeCloseTo(((240 / 1410) * 100 + 25) / 2, 9);
  });

  test('sin posiciones devuelve ceros en vez de NaN', () => {
    const { stats } = buildDashboardStats(buildPortfolio([]), { priceMap: {} });
    expect(stats).toEqual({
      netTotal: 0,
      invested: 0,
      portfolioTotal: 0,
      roi: 0,
      gainPercent: 0,
      avgGain: 0,
      winRate: 0,
      totalFees: 0,
      closedPositions: 0,
    });
  });
});

describe('summarizeClosedPositions', () => {
  test('agrupa ventas por ticker y calcula métricas globales', () => {
    const portfolio = buildPortfolio([
      tx({ id: 1, quantity: 10, pricePerUnit: 100, date: '2024-01-01' }),
      tx({ id: 2, type: 'SELL', quantity: 5, pricePerUnit: 120, date: '2024-01-11' }), // +100
      tx({ id: 3, type: 'SELL', quantity: 5, pricePerUnit: 90, date: '2024-01-21' }), // -50
      tx({ id: 4, assetTicker: 'MSFT', quantity: 2, pricePerUnit: 200, date: '2024-02-01' }),
      tx({ id: 5, assetTicker: 'MSFT', type: 'SELL', quantity: 2, pricePerUnit: 250, date: '2024-03-02' }), // +100
      tx({ id: 6, assetTicker: 'NVDA', quantity: 1, pricePerUnit: 500, date: '2024-02-01' }), // sin ventas
    ]);

    const { closedPositions, progression, metrics } = summarizeClosedPositions(portfolio, { typeMap: { MSFT: 'STOCK' } });

    expect(closedPositions.map((p) => p.ticker)).toEqual(['MSFT', 'AAPL']); // mayor ganancia primero
    const aapl = closedPositions[1];
    expect(aapl.totalTrades).toBe(2);
    expect(aapl.buyCount).toBe(1);
    expect(aapl.totalGainLoss).toBe(50);
    expect(aapl.winningTrades).toBe(1);
    expect(aapl.losingTrades).toBe(1);
    expect(aapl.winRate).toBe(50);
    expect(aapl.totalInvested).toBe(1000);
    expect(aapl.totalRevenue).toBe(1050);
    expect(aapl.roi).toBe(5);
    expect(aapl.avgHoldingDays).toBe(15); // (10*5 + 20*5) / 10
    expect(aapl.trades[0].gainLoss).toBe(-50); // más reciente primero
    expect(aapl.trades[0]).not.toHaveProperty('cumulativeGain');

    expect(progression.map((p) => p.cumulativeGain)).toEqual([100, 50, 150]);

    expect(metrics).toEqual({
      totalTrades: 3,
      totalGainLoss: 150,
      totalInvested: 1400,
      globalROI: (150 / 1400) * 100,
      avgGainPerTrade: 50,
      winRate: (2 / 3) * 100,
      winningTrades: 2,
      losingTrades: 1,
      totalTickers: 2,
      avgHoldingDays: 17, // (50 + 100 + 60) / 12 = 17.5 → floor
    });
  });

  test('sin ventas devuelve estructuras vacías', () => {
    const result = summarizeClosedPositions(buildPortfolio([tx({})]));
    expect(result.closedPositions).toEqual([]);
    expect(result.progression).toEqual([]);
    expect(result.metrics.totalTrades).toBe(0);
    expect(result.metrics.globalROI).toBe(0);
  });
});

describe('buildHoldings', () => {
  test('suma compras, resta ventas y aplica el filtro', () => {
    const holdings = buildHoldings(
      [
        tx({ assetTicker: 'BTC', quantity: 1 }),
        tx({ assetTicker: 'BTC', type: 'SELL', quantity: 0.25 }),
        tx({ assetTicker: 'AAPL', quantity: 3 }),
      ],
      (ticker) => ticker === 'BTC'
    );
    expect(holdings).toEqual({ BTC: 0.75 });
  });
});

describe('sampleSeries', () => {
  const series = Array.from({ length: 10 }, (_, i) => ({ date: new Date(2024, 0, i + 1), i }));

  test('sin opciones devuelve la serie intacta', () => {
    expect(sampleSeries(series)).toBe(series);
  });

  test('sampleEvery conserva extremos y múltiplos del paso', () => {
    expect(sampleSeries(series, { sampleEvery: 3 }).map((s) => s.i)).toEqual([0, 3, 6, 9]);
  });

  test('maxItems reparte uniformemente y conserva extremos', () => {
    const sampled = sampleSeries(series, { maxItems: 4 }).map((s) => s.i);
    expect(sampled[0]).toBe(0);
    expect(sampled[sampled.length - 1]).toBe(9);
    expect(sampled).toHaveLength(4);
  });

  test('maxItems = 1 devuelve el último punto', () => {
    expect(sampleSeries(series, { maxItems: 1 }).map((s) => s.i)).toEqual([9]);
  });

  test('no repite puntos con la misma fecha', () => {
    const sameDate = Array.from({ length: 5 }, () => ({ date: new Date(2024, 0, 1) }));
    expect(sampleSeries(sameDate, { maxItems: 3 })).toHaveLength(1);
  });
});
