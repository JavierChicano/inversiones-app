'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { useCache } from '@/context/CacheContext';

const DAY_MS = 24 * 60 * 60 * 1000;
const inFlightProgressionRequests = new Map();

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function parseInputDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function downsampleEvenly(items, maxPoints) {
  if (items.length <= maxPoints) return items;

  const sampled = [items[0]];
  const step = (items.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    sampled.push(items[Math.round(i * step)]);
  }

  sampled.push(items[items.length - 1]);

  return sampled.filter((item, index, arr) => index === 0 || item.ts !== arr[index - 1].ts);
}

function findNearestIndex(sortedTimestamps, targetTs) {
  if (!sortedTimestamps.length) return -1;

  let left = 0;
  let right = sortedTimestamps.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedTimestamps[mid] < targetTs) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  if (left === 0) return 0;
  const prev = left - 1;
  return Math.abs(sortedTimestamps[left] - targetTs) < Math.abs(sortedTimestamps[prev] - targetTs)
    ? left
    : prev;
}

function formatCustomLabel(inputDate) {
  const parsed = parseInputDate(inputDate);
  if (!parsed) return '-';
  return parsed.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

export default function ProgressionChart({ data, transactions = [], exchangeRate = 1.1 }) {
  const chartRef = useRef(null);
  const [timeRange, setTimeRange] = useState('30d'); // Por defecto 30 días
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [showTransactionMarks, setShowTransactionMarks] = useState(true);
  const [seriesData, setSeriesData] = useState(data || []);
  const [seriesTransactions, setSeriesTransactions] = useState(transactions || []);
  const [isSeriesLoading, setIsSeriesLoading] = useState(false);
  const { getCachedData, setCachedData, PROGRESSION_CACHE_DURATION } = useCache();
  const customRangeQueryKey =
    timeRange === 'custom' ? `${customRange.from || ''}|${customRange.to || ''}` : '';

  // Calcular tasa de conversión de USD a EUR
  const usdToEur = 1 / exchangeRate;

  useEffect(() => {
    setSeriesData(data || []);
  }, [data]);

  useEffect(() => {
    setSeriesTransactions(transactions || []);
  }, [transactions]);

  useEffect(() => {
    if (!seriesData || seriesData.length === 0) return;

    const sorted = [...seriesData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstDate = new Date(sorted[0].date);
    const now = new Date();

    setCustomRange((prev) => {
      const next = {
        from: prev.from || toInputDate(firstDate),
        to: prev.to || toInputDate(now),
      };

      if (prev.from === next.from && prev.to === next.to) {
        return prev;
      }

      return next;
    });
  }, [seriesData]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const now = parseInputDate(toInputDate(new Date())) || new Date();
    let fromDate = null;
    let toDate = new Date(now);

    if (timeRange === '7d') {
      fromDate = new Date(now.getTime() - 7 * DAY_MS);
    } else if (timeRange === '30d') {
      fromDate = new Date(now.getTime() - 30 * DAY_MS);
    } else if (timeRange === '3m') {
      fromDate = new Date(now.getTime() - 90 * DAY_MS);
    } else if (timeRange === '1y') {
      fromDate = new Date(now.getTime() - 365 * DAY_MS);
    } else if (timeRange === 'custom') {
      fromDate = parseInputDate(customRange.from);
      toDate = parseInputDate(customRange.to) || new Date(now);

      if (!fromDate || !toDate) return;
    }

    const spanDays = fromDate ? Math.max(1, Math.ceil((toDate - fromDate) / DAY_MS)) : 1000;

    let sampleEvery = 1;
    let maxSnapshots = 240;

    if (spanDays <= 7) {
      sampleEvery = 1;
      maxSnapshots = 220;
    } else if (spanDays <= 30) {
      sampleEvery = 1;
      maxSnapshots = 260;
    } else if (spanDays <= 90) {
      sampleEvery = 2;
      maxSnapshots = 300;
    } else if (spanDays <= 365) {
      sampleEvery = 4;
      maxSnapshots = 365;
    } else {
      sampleEvery = 8;
      maxSnapshots = 420;
    }

    const params = new URLSearchParams({
      onlyProgression: '1',
      sampleEvery: String(sampleEvery),
      maxSnapshots: String(maxSnapshots),
    });

    if (fromDate) {
      params.set('startDate', fromDate.toISOString());
      params.set('endDate', toDate.toISOString());
    }

    const cacheKey = `dashboard-progression:${params.toString()}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      setSeriesData(cached.progression || []);
      setSeriesTransactions(cached.transactions || []);
      return;
    }

    let isCancelled = false;

    const loadProgression = async () => {
      try {
        setIsSeriesLoading(true);
        let requestPromise = inFlightProgressionRequests.get(cacheKey);
        if (!requestPromise) {
          requestPromise = fetch(`/api/dashboard/stats?${params.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
            .then(async (response) => {
              if (!response.ok) {
                throw new Error('Error al cargar progresion por rango');
              }
              return response.json();
            })
            .finally(() => {
              inFlightProgressionRequests.delete(cacheKey);
            });

          inFlightProgressionRequests.set(cacheKey, requestPromise);
        }

        const payload = await requestPromise;
        if (isCancelled) return;

        setSeriesData(payload.progression || []);
        setSeriesTransactions(payload.transactions || []);
        setCachedData(cacheKey, payload, PROGRESSION_CACHE_DURATION);
      } catch (error) {
        console.error('Error cargando progresion por rango:', error);
      } finally {
        if (!isCancelled) {
          setIsSeriesLoading(false);
        }
      }
    };

    loadProgression();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, customRangeQueryKey]);

  // Memoizar datos filtrados para evitar cambios en dependencias
  const filteredData = useMemo(() => {
    if (!seriesData || seriesData.length === 0) {
      return {
        dates: [],
        values: [],
        invested: [],
        transactionMarks: [],
        performance: null,
        rangeLabel: 'Sin datos',
      };
    }

    const now = new Date();
    const normalizedSnapshots = [...seriesData]
      .map((item) => {
        const parsedDate = new Date(item.date);
        return {
          ts: parsedDate.getTime(),
          date: parsedDate,
          value: Number.isFinite(item.value) ? item.value * usdToEur : null,
          invested: Number.isFinite(item.invested) ? item.invested * usdToEur : null,
        };
      })
      .filter((item) => Number.isFinite(item.ts))
      .sort((a, b) => a.ts - b.ts);

    if (normalizedSnapshots.length === 0) {
      return {
        dates: [],
        values: [],
        invested: [],
        transactionMarks: [],
        performance: null,
        rangeLabel: 'Sin datos',
      };
    }

    let rangeEnd = new Date(now);

    const currentRangeLabel = {
      '7d': 'Ultimos 7 dias',
      '30d': 'Ultimos 30 dias',
      '3m': 'Ultimos 3 meses',
      '1y': 'Ultimo año',
      all: 'Desde inicio',
      custom: 'Personalizado',
    };

    if (timeRange === 'custom') {
      const parsedTo = parseInputDate(customRange.to);
      rangeEnd = parsedTo || new Date(now);
    }

    rangeEnd.setHours(23, 59, 59, 999);

    const snapshotsInRange = normalizedSnapshots;
    const spanDays =
      snapshotsInRange.length > 1
        ? Math.max(
            1,
            Math.round(
              (snapshotsInRange[snapshotsInRange.length - 1].ts - snapshotsInRange[0].ts) / DAY_MS
            )
          )
        : 1;

    if (snapshotsInRange.length === 0) {
      const rangeLabel =
        timeRange === 'custom'
          ? `${formatCustomLabel(customRange.from)} - ${formatCustomLabel(customRange.to)}`
          : currentRangeLabel[timeRange] || 'Ultimos 30 dias';

      return {
        dates: [],
        values: [],
        invested: [],
        transactionMarks: [],
        performance: null,
        rangeLabel,
      };
    }

    // Muestreo adaptativo según el periodo seleccionado para mantener rendimiento y lectura
    const maxPoints =
      spanDays <= 35 ? 60 : spanDays <= 120 ? 90 : spanDays <= 370 ? 130 : 180;

    const sampledSnapshots = downsampleEvenly(snapshotsInRange, maxPoints);
    const sampledTimestamps = sampledSnapshots.map((snapshot) => snapshot.ts);
    const firstSampleTs = sampledTimestamps[0];
    const lastSampleTs = sampledTimestamps[sampledTimestamps.length - 1];

    const useYearInLabel = spanDays > 180;

    const dates = sampledSnapshots.map((snapshot) =>
      snapshot.date.toLocaleDateString(
        'es-ES',
        useYearInLabel ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' }
      )
    );

    const values = sampledSnapshots.map((snapshot) => snapshot.value);
    const invested = sampledSnapshots.map((snapshot) => snapshot.invested);

    // Filtrar y agrupar transacciones dentro del rango de tiempo por fecha
    const transactionsByIndex = new Map();

    seriesTransactions
      .filter((tx) => {
        const txTime = new Date(tx.date).getTime();
        return txTime >= firstSampleTs && txTime <= lastSampleTs;
      })
      .forEach((tx) => {
        const txTime = new Date(tx.date).getTime();
        const pointIndex = findNearestIndex(sampledTimestamps, txTime);

        if (pointIndex < 0 || values[pointIndex] === null || values[pointIndex] === undefined) {
          return;
        }

        if (!transactionsByIndex.has(pointIndex)) {
          transactionsByIndex.set(pointIndex, {
            pointIndex,
            transactions: [],
          });
        }

        transactionsByIndex.get(pointIndex).transactions.push({
          type: tx.type,
          ticker: tx.ticker,
          quantity: tx.quantity,
          pricePerUnit: tx.pricePerUnit,
          fees: tx.fees,
        });
      });

    // Crear marcadores agrupados
    const transactionMarks = Array.from(transactionsByIndex.values())
      .map((group) => {
      const buys = group.transactions.filter((t) => t.type === 'BUY');
      const sells = group.transactions.filter((t) => t.type === 'SELL');

      // Determinar color del marcador
      let color;
      if (sells.length > 0 && buys.length > 0) {
        // Si hay compras y ventas, usar color naranja (mixto)
        color = '#f97316';
      } else if (sells.length > 0) {
        // Solo ventas: rojo
        color = '#ef4444';
      } else {
        // Solo compras: verde
        color = '#22c55e';
      }
      
      // Crear label visible separando compras y ventas
      const buyTickers = buys.map(t => `▲${t.ticker}`);
      const sellTickers = sells.map(t => `▼${t.ticker}`);

      // Mostrar primero las compras, luego las ventas
      const label = [...buyTickers, ...sellTickers].join(' ');

      const markerValue = values[group.pointIndex];
      if (markerValue === null) return null;

      return {
        coord: [group.pointIndex, markerValue],
        color,
        label,
        transactions: group.transactions,
        buys: buys.length,
        sells: sells.length,
      };
    })
      .filter(Boolean);

    let firstSnapshotIndex = -1;
    let lastSnapshotIndex = -1;

    for (let i = 0; i < values.length; i++) {
      if (values[i] !== null && invested[i] !== null) {
        firstSnapshotIndex = i;
        break;
      }
    }

    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] !== null && invested[i] !== null) {
        lastSnapshotIndex = i;
        break;
      }
    }

    let performance = null;
    if (firstSnapshotIndex !== -1 && lastSnapshotIndex !== -1 && lastSnapshotIndex > firstSnapshotIndex) {
      const startValue = values[firstSnapshotIndex];
      const endValue = values[lastSnapshotIndex];
      const startInvested = invested[firstSnapshotIndex];
      const endInvested = invested[lastSnapshotIndex];

      const portfolioChange = endValue - startValue;
      const capitalChange = endInvested - startInvested;
      const netGain = portfolioChange - capitalChange;
      const netGainPct = startInvested > 0 ? (netGain / startInvested) * 100 : null;

      performance = {
        netGain,
        netGainPct,
        capitalChange,
      };
    }

    const rangeLabel =
      timeRange === 'custom'
        ? `${formatCustomLabel(customRange.from)} - ${formatCustomLabel(customRange.to)}`
        : currentRangeLabel[timeRange] || 'Ultimos 30 dias';

    return { dates, values, invested, transactionMarks, performance, rangeLabel };
  }, [seriesData, seriesTransactions, timeRange, usdToEur, customRange]);

  useEffect(() => {
    if (!chartRef.current || filteredData.dates.length === 0) return;

    const chart = echarts.init(chartRef.current);

    const { dates, values, invested, transactionMarks } = filteredData;

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderColor: '#333',
        textStyle: {
          color: '#fff',
        },
        formatter: (params) => {
          let result = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach((param) => {
            // Solo mostrar si hay valor (no null)
            if (param.value !== null && param.value !== undefined) {
              const value = param.value.toLocaleString('es-ES', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              result += `${param.marker} ${param.seriesName}: €${value}<br/>`;
            }
          });
          return result;
        },
      },
      legend: {
        data: ['Valor Total', 'Invertido'],
        top: 10,
        left: 'center',
        textStyle: {
          color: '#e4e4e7',
          fontSize: 13,
          fontWeight: '500',
        },
        itemWidth: 25,
        itemHeight: 14,
        itemGap: 20,
        icon: 'roundRect',
        borderRadius: 4,
        // Forzar colores específicos para cada item
        itemStyle: {
          borderWidth: 0,
        },
      },
      // Definir paleta de colores global
      color: ['#3b82f6', '#a1a1aa'],
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLine: {
          lineStyle: {
            color: '#3f3f46',
          },
        },
        axisLabel: {
          color: '#a1a1aa',
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        scale: true, // Ajustar automáticamente el rango en lugar de empezar desde 0
        axisLine: {
          lineStyle: {
            color: '#3f3f46',
          },
        },
        axisLabel: {
          color: '#a1a1aa',
          formatter: (value) => `€${value.toLocaleString('es-ES')}`,
        },
        splitLine: {
          lineStyle: {
            color: '#27272a',
          },
        },
      },
      series: [
        {
          name: 'Valor Total',
          type: 'line',
          smooth: true,
          data: values,
          lineStyle: {
            color: '#3b82f6',
            width: 3,
          },
          showSymbol: false, // Ocultar puntos, solo línea
          connectNulls: false, // No conectar líneas donde no hay datos
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ]),
          },
          markPoint: showTransactionMarks
            ? {
            symbol: 'pin',
            symbolSize: 50,
            data: transactionMarks.map(mark => ({
              coord: mark.coord,
              value: mark.label,
              itemStyle: {
                color: mark.color,
                borderColor: '#fff',
                borderWidth: 2,
                shadowBlur: 4,
                shadowColor: 'rgba(0, 0, 0, 0.3)',
              },
              label: {
                show: true,
                position: 'top',
                distance: 10,
                formatter: mark.label,
                color: '#fff',
                fontSize: 11,
                fontWeight: 'bold',
                backgroundColor: mark.color,
                padding: [3, 6],
                borderRadius: 3,
                shadowBlur: 2,
                shadowColor: 'rgba(0, 0, 0, 0.3)',
              },
              emphasis: {
                scale: 1.2,
                label: {
                  show: true,
                  formatter: () => {
                    const lines = [];
                    mark.transactions.forEach(tx => {
                      const icon = tx.type === 'BUY' ? '💚' : '🔴';
                      lines.push(`${icon} ${tx.ticker}: ${tx.quantity.toFixed(2)} - $${tx.pricePerUnit.toFixed(2)}`);
                    });
                    return lines.join('\n');
                  },
                  color: '#fff',
                  fontSize: 11,
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  padding: [6, 10],
                  borderRadius: 4,
                  borderColor: mark.color,
                  borderWidth: 2,
                  shadowBlur: 4,
                  shadowColor: 'rgba(0, 0, 0, 0.5)',
                  lineHeight: 16,
                },
              },
            })),
            }
            : { data: [] },
        },
        {
          name: 'Invertido',
          type: 'line',
          smooth: true,
          data: invested,
          lineStyle: {
            color: '#a1a1aa',
            width: 2,
            type: 'dashed',
          },
          showSymbol: false, // Ocultar puntos, solo línea
          connectNulls: false, // No conectar líneas donde no hay datos
        },
      ],
    };

    chart.setOption(option, { notMerge: true });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [filteredData, showTransactionMarks]); // Solo depender de datos y toggle

  const periodPerformance = filteredData.performance;
  return (
    <div className="relative bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 h-full">
      <div className="mb-2 flex flex-col gap-2">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-white text-lg font-semibold">Progresión del Portfolio</h3>
            <p className="text-xs text-zinc-400 mt-1">Periodo activo: {filteredData.rangeLabel}</p>
          </div>

          {periodPerformance ? (
            <div className="min-w-65 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm">
              <p className="text-zinc-400 text-[11px] uppercase tracking-[0.16em]">Rendimiento del periodo</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  periodPerformance.netGain >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {periodPerformance.netGainPct !== null
                  ? `${periodPerformance.netGainPct >= 0 ? '+' : ''}${periodPerformance.netGainPct.toFixed(2)}%`
                  : 'N/D'}{' '}
                <span className="text-sm text-zinc-300 font-semibold">
                  ({periodPerformance.netGain >= 0 ? '+' : ''}
                  €{Math.abs(periodPerformance.netGain).toLocaleString('es-ES', { maximumFractionDigits: 2 })})
                </span>
              </p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Excluye aportes netos de €
                {periodPerformance.capitalChange.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
              Sin suficientes snapshots para calcular rendimiento del periodo.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="cursor-pointer bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Ultimos 7 dias</option>
              <option value="30d">Ultimos 30 dias</option>
              <option value="3m">Ultimos 3 meses</option>
              <option value="1y">Ultimo año</option>
              <option value="all">Desde inicio</option>
              <option value="custom">Personalizado</option>
            </select>

            {timeRange === 'custom' && (
              <>
                <input
                  type="date"
                  value={customRange.from}
                  onChange={(e) =>
                    setCustomRange((prev) => ({
                      ...prev,
                      from: e.target.value,
                    }))
                  }
                  className="bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-zinc-500 text-sm">a</span>
                <input
                  type="date"
                  value={customRange.to}
                  onChange={(e) =>
                    setCustomRange((prev) => ({
                      ...prev,
                      to: e.target.value,
                    }))
                  }
                  className="bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowTransactionMarks((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-pressed={showTransactionMarks}
            title={showTransactionMarks ? 'Ocultar burbujas de compra/venta' : 'Mostrar burbujas de compra/venta'}
          >
            <span className="relative inline-flex h-5 w-5 items-center justify-center">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-cyan-300" />
              {!showTransactionMarks && (
                <span className="absolute h-0.5 w-5 rotate-[-28deg] rounded bg-rose-400" />
              )}
            </span>
            <span>{showTransactionMarks ? 'Burbujas activas' : 'Burbujas ocultas'}</span>
          </button>
        </div>

        {isSeriesLoading && (
          <div className="pointer-events-none absolute right-4 top-3 text-xs text-cyan-300">
            Actualizando rango...
          </div>
        )}
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '340px' }} />
    </div>
  );
}
