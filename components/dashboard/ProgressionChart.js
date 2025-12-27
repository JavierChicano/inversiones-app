'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';

export default function ProgressionChart({ data }) {
  const chartRef = useRef(null);
  const [timeRange, setTimeRange] = useState('30d'); // Por defecto 30 días

  // Memoizar datos filtrados para evitar cambios en dependencias
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return { dates: [], values: [], invested: [], netGains: [] };
    
    const now = new Date();
    let cutoffDate;
    let intervalDays;

    switch (timeRange) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        intervalDays = 7;
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        intervalDays = 30;
        break;
      case '3m':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        intervalDays = 90;
        break;
      case '1y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        intervalDays = 365;
        break;
      default:
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        intervalDays = 30;
    }

    // Generar todas las fechas del rango (completo)
    const allDates = [];
    for (let i = intervalDays; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      allDates.push(date);
    }

    // Crear mapa de datos reales
    const dataMap = new Map();
    data.forEach(item => {
      const itemDate = new Date(item.date);
      const dateKey = itemDate.toDateString();
      dataMap.set(dateKey, item);
    });

    // Combinar fechas completas con datos disponibles
    const dates = allDates.map(date => 
      date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
    );
    
    const values = allDates.map(date => {
      const dateKey = date.toDateString();
      return dataMap.has(dateKey) ? dataMap.get(dateKey).value : null;
    });
    
    const invested = allDates.map(date => {
      const dateKey = date.toDateString();
      return dataMap.has(dateKey) ? dataMap.get(dateKey).invested : null;
    });
    
    const netGains = allDates.map(date => {
      const dateKey = date.toDateString();
      return dataMap.has(dateKey) ? dataMap.get(dateKey).netGain : null;
    });

    return { dates, values, invested, netGains };
  }, [data, timeRange]);

  useEffect(() => {
    if (!chartRef.current || filteredData.dates.length === 0) return;

    const chart = echarts.init(chartRef.current);

    const { dates, values, invested, netGains } = filteredData;

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
        data: ['Valor Total', 'Invertido', 'Ganancia Neta'],
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
          showSymbol: false, // Ocultar puntos, solo línea
          connectNulls: false, // No conectar líneas donde no hay datos
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
          showSymbol: false, // Ocultar puntos, solo línea
          connectNulls: false, // No conectar líneas donde no hay datos
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
          showSymbol: false, // Ocultar puntos, solo línea
          connectNulls: false, // No conectar líneas donde no hay datos
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
  }, [filteredData]); // Solo depender de filteredData memoizado

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-lg font-semibold">
          Progresión con el tiempo - neto
        </h3>
        
        {/* Selector de rango de tiempo */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="cursor-pointer bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="3m">Últimos 3 meses</option>
          <option value="1y">Último año</option>
        </select>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}
