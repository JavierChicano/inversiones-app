'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import { formatCurrency, formatMonthYear } from '@/lib/utils/formatters';

const GREEN = '#22c55e';
const RED = '#ef4444';
const PRIMARY = '#6366f1';

function KpiTile({ label, value, hint, valueClassName = 'text-white' }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${valueClassName}`}>{value}</div>
      {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
}

function disciplineColor(rate) {
  if (rate >= 75) return 'text-green-500';
  if (rate >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

function disciplineBarColor(rate) {
  if (rate >= 75) return 'bg-green-500';
  if (rate >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Disciplina de aportación: KPIs + gráfico de barras con la aportación neta mensual en EUR.
 * Recibe la respuesta de /api/profile/contributions ({ source, months, metrics }).
 */
export default function ContributionDisciplineChart({ data, loading, error }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const months = useMemo(() => data?.months || [], [data]);
  const metrics = data?.metrics;

  useEffect(() => {
    if (!chartRef.current || months.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;
    const avgContribution = metrics?.avgMonthlyContribution || 0;

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderColor: '#333',
        textStyle: { color: '#fff' },
        formatter: (params) => {
          const index = params[0]?.dataIndex ?? 0;
          const month = months[index];
          if (!month) return '';

          const lines = [`<strong>${formatMonthYear(month.key)}</strong>`];
          if (month.operations === 0) {
            lines.push('<span style="color:#a1a1aa">Sin aportaciones</span>');
          } else {
            lines.push(`<span style="color:${GREEN}">●</span> Aportado: ${formatCurrency(month.inflowEur)}`);
            if (month.outflowEur > 0) {
              lines.push(`<span style="color:${RED}">●</span> Retirado: ${formatCurrency(month.outflowEur)}`);
            }
            lines.push(`<span style="color:#e4e4e7">●</span> Neto: <strong>${formatCurrency(month.netEur)}</strong>`);
            lines.push(`<span style="color:#a1a1aa">${month.operations} ${month.operations === 1 ? 'operación' : 'operaciones'}</span>`);
          }
          lines.push(`<span style="color:${PRIMARY}">┄</span> Media mensual: ${formatCurrency(avgContribution)}`);
          return lines.join('<br/>');
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: months.length > 24 ? '18%' : '3%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: months.map((m) => m.label),
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#a1a1aa',
          rotate: months.length > 12 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisLabel: {
          color: '#a1a1aa',
          formatter: (value) => `€${value.toLocaleString('es-ES')}`,
        },
        splitLine: { lineStyle: { color: '#27272a' } },
      },
      dataZoom:
        months.length > 24
          ? [
              {
                type: 'slider',
                start: Math.max(0, 100 - (24 / months.length) * 100),
                end: 100,
                height: 18,
                bottom: 8,
                borderColor: '#3f3f46',
                backgroundColor: '#18181b',
                fillerColor: 'rgba(99, 102, 241, 0.2)',
                handleStyle: { color: PRIMARY },
                textStyle: { color: '#a1a1aa' },
              },
            ]
          : undefined,
      series: [
        {
          name: 'Aportación neta',
          type: 'bar',
          barWidth: '55%',
          barMaxWidth: 42,
          showBackground: true,
          backgroundStyle: {
            color: 'rgba(63, 63, 70, 0.25)',
            borderRadius: 4,
          },
          data: months.map((m) => ({
            value: m.netEur,
            itemStyle: {
              color: m.netEur >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
              borderColor: m.netEur >= 0 ? GREEN : RED,
              borderWidth: 2,
              borderRadius: m.netEur >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
            },
          })),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: PRIMARY, type: 'dashed', width: 2 },
            label: {
              show: true,
              position: 'insideEndTop',
              color: PRIMARY,
              formatter: () => `Media ${formatCurrency(avgContribution)}`,
            },
            data: [{ yAxis: avgContribution }],
          },
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [months, metrics]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-zinc-800/60 rounded-lg" />
          ))}
        </div>
        <div className="h-60 bg-zinc-800/60 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  if (!metrics || months.length === 0) {
    return (
      <p className="text-zinc-500 text-sm">
        Registra tus cambios de divisa EUR → USD en la sección Divisas para medir tu disciplina de aportación.
      </p>
    );
  }

  const rate = metrics.disciplineRate || 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Disciplina</div>
          <div className={`text-lg font-bold ${disciplineColor(rate)}`}>{rate.toFixed(0)}%</div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${disciplineBarColor(rate)} transition-all`}
              style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
            />
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {metrics.monthsWithContribution} de {metrics.monthsTotal} meses con aportación
          </div>
        </div>
        <KpiTile
          label="Media mensual"
          value={formatCurrency(metrics.avgMonthlyContribution)}
          hint={`Neto: ${formatCurrency(metrics.avgMonthlyNet)} / mes`}
        />
        <KpiTile
          label="Racha actual"
          value={`${metrics.currentStreak} ${metrics.currentStreak === 1 ? 'mes' : 'meses'}`}
          hint={`Mejor racha: ${metrics.longestStreak} ${metrics.longestStreak === 1 ? 'mes' : 'meses'}`}
          valueClassName={metrics.currentStreak > 0 ? 'text-green-500' : 'text-zinc-300'}
        />
        <KpiTile
          label="Aportado neto"
          value={formatCurrency(metrics.netContributedEur)}
          hint={`${formatCurrency(metrics.totalContributedEur)} enviados · ${formatCurrency(metrics.totalWithdrawnEur)} retirados`}
        />
      </div>

      <div ref={chartRef} style={{ width: '100%', height: '260px' }} />

      <p className="text-xs text-zinc-500">
        {data.source === 'transactions'
          ? 'Sin cambios de divisa registrados: la aportación se aproxima con compras menos ventas convertidas al tipo de cambio actual.'
          : 'Aportación = cambios EUR → USD (dinero enviado a invertir) menos cambios USD → EUR (dinero retirado). No incluye beneficios reinvertidos.'}
        {metrics.bestMonth && ` Mejor mes: ${formatMonthYear(metrics.bestMonth.key)} (${formatCurrency(metrics.bestMonth.inflowEur)}).`}
      </p>
    </div>
  );
}
