'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function ProgressionChart({ data }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const chart = echarts.init(chartRef.current);

    const dates = data.map((item) => 
      new Date(item.date).toLocaleDateString('es-ES', { 
        month: 'short', 
        day: 'numeric' 
      })
    );
    const values = data.map((item) => item.value);
    const invested = data.map((item) => item.invested);
    const netGains = data.map((item) => item.netGain);

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
            result += `${param.marker} ${param.seriesName}: €${value}<br/>`;
          });
          return result;
        },
      },
      legend: {
        data: ['Valor Total', 'Invertido', 'Ganancia Neta'],
        textStyle: {
          color: '#a1a1aa',
        },
        top: 0,
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
          name: 'Valor Total',
          type: 'line',
          smooth: true,
          data: values,
          lineStyle: {
            color: '#3b82f6',
            width: 3,
          },
          itemStyle: {
            color: '#3b82f6',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ]),
          },
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
          itemStyle: {
            color: '#a1a1aa',
          },
        },
        {
          name: 'Ganancia Neta',
          type: 'line',
          smooth: true,
          data: netGains,
          lineStyle: {
            color: '#22c55e',
            width: 2,
          },
          itemStyle: {
            color: '#22c55e',
          },
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
        Progresión con el tiempo - neto
      </h3>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}
