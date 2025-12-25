'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function WinRateChart({ winRate, positions }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Inicializar o reutilizar instancia existente
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    // Calcular número de posiciones ganadoras y perdedoras
    const totalPositions = positions?.length || 0;
    const winningPositions = positions?.filter(p => p.gainLoss > 0).length || 0;
    const losingPositions = totalPositions - winningPositions;

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
          const count = params.name === 'Winning' ? winningPositions : losingPositions;
          return `${params.name}: ${count} (${params.value.toFixed(1)}%)`;
        },
      },
      legend: {
        show: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: '#a1a1aa',
          fontSize: 16,
          fontWeight: '600',
        },
        formatter: (name) => {
          const count = name === 'Winning' ? winningPositions : losingPositions;
          return `${count}`;
        },
      },
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: 'center',
          style: {
            text: `${totalPositions}`,
            fontSize: 32,
            fontWeight: 'bold',
            fill: '#ffffff',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '60%',
          style: {
            text: 'Posiciones',
            fontSize: 14,
            fill: '#a1a1aa',
          },
        },
      ],
      series: [
        {
          name: 'Win Rate',
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: false,
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            {
              value: winRate,
              name: 'Winning',
              itemStyle: {
                color: '#22c55e',
              },
            },
            {
              value: 100 - winRate,
              name: 'Losing',
              itemStyle: {
                color: '#27272a',
              },
            },
          ],
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
  }, [winRate, positions]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-full">
      <h3 className="text-white text-lg font-semibold mb-4">Win Rate</h3>
      <div ref={chartRef} style={{ width: '100%', height: '250px' }} />
    </div>
  );
}
