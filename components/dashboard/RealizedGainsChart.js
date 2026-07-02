'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';

const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

function toLocalDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatGroupLabel(date, groupBy) {
  if (groupBy === 'month') {
    return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
  }

  if (groupBy === 'year') {
    return date.toLocaleDateString('es-ES', { year: 'numeric' });
  }

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function getBucketInfo(date, groupBy) {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (groupBy === 'week') {
    const weekStart = startOfWeek(localDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return {
      key: toLocalDateKey(weekStart),
      sortTs: weekStart.getTime(),
      label: `${formatGroupLabel(weekStart, 'day')} - ${formatGroupLabel(weekEnd, 'day')}`,
    };
  }

  if (groupBy === 'month') {
    const monthStart = new Date(localDate.getFullYear(), localDate.getMonth(), 1);
    return {
      key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      sortTs: monthStart.getTime(),
      label: formatGroupLabel(monthStart, 'month'),
    };
  }

  if (groupBy === 'year') {
    const yearStart = new Date(localDate.getFullYear(), 0, 1);
    return {
      key: String(yearStart.getFullYear()),
      sortTs: yearStart.getTime(),
      label: formatGroupLabel(yearStart, 'year'),
    };
  }

  return {
    key: toLocalDateKey(localDate),
    sortTs: localDate.getTime(),
    label: formatGroupLabel(localDate, 'day'),
  };
}

export default function RealizedGainsChart({ data, exchangeRate = 1.1 }) {
  const chartRef = useRef(null);
  const [groupBy, setGroupBy] = useState('day');
  const usdToEur = 1 / exchangeRate;
  const barSeriesName = groupBy === 'day' ? 'Ganancia por Operación' : 'Ganancia del Periodo';

  const groupedData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        dates: [],
        cumulativeGains: [],
        tradeGains: [],
        periodDetails: [],
      };
    }

    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const bucketMap = new Map();

    sortedData.forEach((item) => {
      const parsedDate = new Date(item.date);
      if (Number.isNaN(parsedDate.getTime())) return;

      const bucketInfo = getBucketInfo(parsedDate, groupBy);
      const gainLoss = Number(item.gainLoss) || 0;

      if (!bucketMap.has(bucketInfo.key)) {
        bucketMap.set(bucketInfo.key, {
          ...bucketInfo,
          gainLoss: 0,
          trades: [],
        });
      }

      const bucket = bucketMap.get(bucketInfo.key);
      bucket.gainLoss += gainLoss;
      bucket.trades.push(item);
    });

    const buckets = [...bucketMap.values()].sort((a, b) => a.sortTs - b.sortTs);
    let cumulative = 0;

    const dates = [];
    const cumulativeGains = [];
    const tradeGains = [];
    const periodDetails = [];

    buckets.forEach((bucket) => {
      cumulative += bucket.gainLoss;
      dates.push(bucket.label);
      cumulativeGains.push(cumulative * usdToEur);
      tradeGains.push({
        value: bucket.gainLoss * usdToEur,
        itemStyle: {
          color: bucket.gainLoss >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
          borderColor: bucket.gainLoss >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
          borderWidth: 2,
          borderRadius: bucket.gainLoss >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
        },
      });
      periodDetails.push({
        label: bucket.label,
        gainLoss: bucket.gainLoss,
        tradeCount: bucket.trades.length,
        trades: bucket.trades,
      });
    });

    return {
      dates,
      cumulativeGains,
      tradeGains,
      periodDetails,
    };
  }, [data, groupBy, usdToEur]);

  useEffect(() => {
    if (!chartRef.current || !groupedData.dates.length) return;

    const chart = echarts.init(chartRef.current);

    // Preparar datos
    const { dates, cumulativeGains, tradeGains, periodDetails } = groupedData;

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
          const periodDetail = periodDetails[params[0].dataIndex];

          params.forEach((param) => {
            const value = param.value.toLocaleString('es-ES', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            result += `${param.marker} ${param.seriesName}: €${value}`;
            if (param.seriesIndex === 1 && periodDetail) {
              result += groupBy === 'day'
                ? ` (${periodDetail.tradeCount} ops.)`
                : ` (${periodDetail.tradeCount} operaciones)`;
            }
            result += '<br/>';
          });
          return result;
        },
      },
      legend: {
        data: [
          {
            name: 'Ganancia Acumulada',
            icon: 'roundRect',
            itemStyle: {
              color: '#3b82f6',
            },
          },
          {
            name: barSeriesName,
            icon: 'roundRect',
            itemStyle: {
              color: '#22c55e',
            },
          },
        ],
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
      },
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
          rotate: 45,
        },
      },
      yAxis: {
        type: 'value',
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
          name: 'Ganancia Acumulada',
          type: 'line',
          smooth: false,
          data: cumulativeGains,
          lineStyle: {
            color: '#3b82f6',
            width: 2,
          },
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#3b82f6',
            borderColor: '#1e40af',
            borderWidth: 2,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ]),
          },
        },
        {
          name: barSeriesName,
          type: 'bar',
          data: tradeGains,
          barWidth: '40%',
          barMaxWidth: 30,
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [groupedData]);

  return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-full">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-white text-lg font-semibold">
          Ganancias Realizadas con el Tiempo
        </h3>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Agrupar por</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="cursor-pointer bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {GROUP_BY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}
