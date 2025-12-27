'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function RealizedGainsChart({ data }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const chart = echarts.init(chartRef.current);

    // Preparar datos
    const dates = data.map(item => 
      new Date(item.date).toLocaleDateString('es-ES', { 
        month: 'short', 
        day: 'numeric',
        year: '2-digit'
      })
    );
    const cumulativeGains = data.map(item => item.cumulativeGain);
    const tradeGains = data.map(item => item.gainLoss);

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
            const value = param.value.toLocaleString('es-ES', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            const ticker = data[param.dataIndex]?.ticker || '';
            result += `${param.marker} ${param.seriesName}: €${value}`;
            if (ticker && param.seriesIndex === 1) {
              result += ` (${ticker})`;
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
            name: 'Ganancia por Operación',
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
          name: 'Ganancia por Operación',
          type: 'bar',
          data: tradeGains,
          itemStyle: {
            color: (params) => {
              return params.value >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
            },
            borderColor: (params) => {
              return params.value >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)';
            },
            borderWidth: 2,
            borderRadius: [4, 4, 0, 0],
          },
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
  }, [data]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-full">
      <h3 className="text-white text-lg font-semibold mb-4">
        Ganancias Realizadas con el Tiempo
      </h3>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}
