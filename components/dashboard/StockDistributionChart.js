'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function StockDistributionChart({ data, exchangeRate = 1.1 }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Si no hay datos, no inicializar el gráfico
    if (!data || data.length === 0) return;

    // Inicializar o reutilizar instancia existente
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    // Calcular el total de dinero en USD (los valores ya vienen en USD)
    const totalValueUSD = data.reduce((sum, item) => sum + item.currentValue, 0);

    // Detectar si es mobile
    const isMobile = window.innerWidth < 1024;

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderColor: '#333',
        textStyle: {
          color: '#fff',
        },
        formatter: (params) => {
          return `
            <strong>${params.name}</strong><br/>
            Valor: $${params.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}<br/>
            Porcentaje: ${params.percent.toFixed(2)}%
          `;
        },
      },
      legend: {
        orient: isMobile ? 'horizontal' : 'vertical',
        right: isMobile ? 'center' : '10%',
        top: isMobile ? '0%' : 'center',
        textStyle: {
          color: '#a1a1aa',
        },
      },
      graphic: [
        {
          type: 'text',
          left: isMobile ? 'center' : '29%',
          top: isMobile ? '55%' : 'center',
          style: {
            text: `$${totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            fontSize: isMobile ? 18 : 22,
            fontWeight: 'bold',
            fill: '#ffffff',
            textAlign: 'center',
          },
        },
      ],
      series: [
        {
          name: 'Stock Distribution',
          type: 'pie',
          radius: isMobile ? ['40%', '65%'] : ['55%', '80%'],
          center: isMobile ? ['50%', '60%'] : ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#18181b',
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'outside',
            formatter: (params) => {
              // Mostrar nombre y porcentaje fuera del sector
              return `{name|${params.name}}\n{percent|${params.percent.toFixed(1)}%}`;
            },
            rich: {
              name: {
                color: '#fff',
                fontSize: 14,
                fontWeight: 'bold',
                lineHeight: 20,
              },
              percent: {
                color: '#a1a1aa',
                fontSize: 12,
                lineHeight: 18,
              },
            },
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: true,
            length: 15,
            length2: 10,
            lineStyle: {
              color: '#52525b',
              width: 1,
            },
          },
          data: data.map((item, index) => ({
            value: item.currentValue,
            name: item.ticker,
            itemStyle: {
              color: [
                '#3b82f6', // blue
                '#eab308', // yellow
                '#ef4444', // red
                '#22c55e', // green
                '#a855f7', // purple
                '#f97316', // orange
                '#06b6d4', // cyan
                '#ec4899', // pink
                '#84cc16', // lime
                '#f59e0b', // amber
                '#8b5cf6', // violet
                '#14b8a6', // teal
                '#f43f5e', // rose
                '#10b981', // emerald
                '#6366f1', // indigo
                '#fb923c', // orange-400
              ][index % 16],
            },
          })),
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [data]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-full flex flex-col">
      <h3 className="text-white text-lg font-semibold mb-4">Stock</h3>
      {!data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-center">Gráfico sin datos</p>
        </div>
      ) : (
        <div ref={chartRef} style={{ width: '100%', height: '350px' }} />
      )}
    </div>
  );
}
