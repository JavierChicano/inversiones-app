'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';

export default function ProgressionChart({ data, transactions = [], exchangeRate = 1.1 }) {
  const chartRef = useRef(null);
  const [timeRange, setTimeRange] = useState('30d'); // Por defecto 30 días

  // Calcular tasa de conversión de USD a EUR
  const usdToEur = 1 / exchangeRate;

  // Memoizar datos filtrados para evitar cambios en dependencias
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return { dates: [], values: [], invested: [], transactionMarks: [] };
    
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
      // Convertir de USD a EUR
      return dataMap.has(dateKey) ? dataMap.get(dateKey).value * usdToEur : null;
    });
    
    // Usar solo los valores de invested de los snapshots (no calcular valores inventados)
    const invested = allDates.map(date => {
      const dateKey = date.toDateString();
      if (dataMap.has(dateKey) && dataMap.get(dateKey).invested !== null) {
        // Convertir snapshot de USD a EUR
        return dataMap.get(dateKey).invested * usdToEur;
      }
      return null;
    });

    // Filtrar y agrupar transacciones dentro del rango de tiempo por fecha
    const transactionsByDate = new Map();
    
    transactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= cutoffDate && txDate <= now;
      })
      .forEach(tx => {
        const txDate = new Date(tx.date);
        const dateStr = txDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
        const dateIndex = dates.indexOf(dateStr);
        
        if (dateIndex === -1) return;
        
        const dateKey = `${dateIndex}`;
        if (!transactionsByDate.has(dateKey)) {
          transactionsByDate.set(dateKey, {
            dateIndex,
            dateStr,
            value: values[dateIndex],
            transactions: [],
          });
        }
        
        transactionsByDate.get(dateKey).transactions.push({
          type: tx.type,
          ticker: tx.ticker,
          quantity: tx.quantity,
          pricePerUnit: tx.pricePerUnit,
          fees: tx.fees,
        });
      });

    // Crear marcadores agrupados
    const transactionMarks = Array.from(transactionsByDate.values()).map(group => {
      const buys = group.transactions.filter(t => t.type === 'BUY');
      const sells = group.transactions.filter(t => t.type === 'SELL');
      
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
      
      return {
        coord: [group.dateIndex, group.value],
        color,
        label,
        transactions: group.transactions,
        buys: buys.length,
        sells: sells.length,
      };
    });

    return { dates, values, invested, transactionMarks };
  }, [data, transactions, timeRange, usdToEur]);

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
          markPoint: {
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
          Progresión del Portfolio
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
