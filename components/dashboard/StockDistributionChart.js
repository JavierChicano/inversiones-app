'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function StockDistributionChart({ data, exchangeRate = 1.1 }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const totalValueUSD = data
    ? data.reduce((sum, item) => sum + item.currentValue, 0)
    : 0;

  const formatCurrencyUSD = (value) =>
    `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const summaryItems = data
    ? [
        {
          key: 'STOCK',
          label: 'Acciones',
          color: '#3b82f6',
          value: data.filter((item) => item.type === 'STOCK').reduce((sum, item) => sum + item.currentValue, 0),
        },
        {
          key: 'CRYPTO',
          label: 'Crypto',
          color: '#eab308',
          value: data.filter((item) => item.type === 'CRYPTO').reduce((sum, item) => sum + item.currentValue, 0),
        },
      ]
    : [];

  useEffect(() => {
    if (!chartRef.current) return;

    // Si no hay datos, no inicializar el gráfico
    if (!data || data.length === 0) return;

    // Inicializar o reutilizar instancia existente
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

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
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-full flex flex-col relative overflow-hidden">
      <h3 className="text-white text-lg font-semibold mb-4">Stock</h3>
      {!(!data || data.length === 0) && (
        <div className="hidden lg:block absolute top-6 right-6 z-10 w-60 rounded-xl border border-zinc-700/80 bg-zinc-950/70 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">
              Resumen
            </span>
            <span className="text-[11px] text-zinc-500">Crypto vs Acciones</span>
          </div>

          <div className="space-y-2">
            {summaryItems.map((item) => {
              const percentage = totalValueUSD > 0 ? (item.value / totalValueUSD) * 100 : 0;

              return (
                <div key={item.key} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-zinc-100 font-medium truncate">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm text-white font-semibold tabular-nums text-right">
                    {formatCurrencyUSD(item.value)} · {percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
