'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRefresh } from '@/app/dashboard/layout';
import {
  formatCurrency,
  formatDurationMinutes,
  formatHoldingTime,
  formatSignedPercent as formatPercent,
} from '@/lib/utils/formatters';
import SplitStatsCard from '@/components/dashboard/SplitStatsCard';
import Amount from '@/components/Amount';
import RealizedGainsChart from '@/components/dashboard/RealizedGainsChart';
import ClosedPositionsTable from '@/components/dashboard/ClosedPositionsTable';
import { TrendingUpIcon, PercentIcon, BarChartIcon, CashIcon, ClockIcon } from '@/components/icons';

export default function AnalyticsPage() {
  const { token } = useAuth();
  const { refreshVersion } = useRefresh();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch('/api/analytics/closed-positions', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Error al cargar análisis');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [token, refreshVersion]);

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-zinc-400 mt-4">Cargando análisis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6">
        <p className="text-red-400">⚠️ {error}</p>
      </div>
    );
  }

  if (!data || data.closedPositions.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Análisis de Posiciones Cerradas</h2>
        <p className="text-zinc-400 mb-6">
          Análisis detallado del rendimiento de tus operaciones realizadas.
        </p>
        
        <div className="bg-zinc-800/50 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-zinc-400">
            No hay posiciones cerradas aún. Las ventas al contado y los cierres de posiciones apalancadas aparecerán aquí.
          </p>
        </div>
      </div>
    );
  }

  const { metrics, closedPositions, progression } = data;
  const usdToEur = 1 / data.exchangeRate.eurUsd;
  const EMPTY_SEGMENT = { totalTrades: 0, totalGainLoss: 0, totalGainLossEur: 0, totalInvested: 0, totalInvestedEur: 0, globalROI: 0, avgGainPerTrade: 0, avgGainPerTradeEur: 0, winRate: 0, winningTrades: 0, losingTrades: 0, avgHoldingDays: 0, avgHoldingMinutes: 0 };
  const spotMetrics = { ...EMPTY_SEGMENT, ...(metrics.spot || {}) };
  const leverageMetrics = { ...EMPTY_SEGMENT, liquidations: 0, ...(metrics.leverage || {}) };
  const pnlClass = (value) => (value >= 0 ? 'text-green-400' : 'text-red-400');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Análisis de Posiciones Cerradas</h2>
        <p className="text-zinc-400">
          Rendimiento histórico de tus operaciones completadas: ventas al contado (compra → venta) y cierres de
          posiciones apalancadas (CFD, con P&amp;L neto de comisiones y swap).
        </p>
      </div>

      {/* Métricas principales: total destacado + desglose contado / CFD */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <SplitStatsCard
          title="Ganancia Total Realizada"
          value={
            <span className={metrics.totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}>
              {formatCurrency(metrics.totalGainLossEur)}
            </span>
          }
          subValue={`${metrics.totalTrades} operaciones en ${metrics.totalTickers} tickers`}
          sensitive
          color={metrics.totalGainLoss >= 0 ? 'green' : 'red'}
          icon={<CashIcon className="w-6 h-6" />}
          segments={[
            {
              label: 'Contado',
              tone: 'spot',
              value: formatCurrency(spotMetrics.totalGainLossEur),
              valueClassName: pnlClass(spotMetrics.totalGainLoss),
              hint: `${spotMetrics.totalTrades} ventas`,
            },
            {
              label: 'CFD',
              tone: 'cfd',
              value: formatCurrency(leverageMetrics.totalGainLossEur),
              valueClassName: pnlClass(leverageMetrics.totalGainLoss),
              hint: `${leverageMetrics.totalTrades} cierres`,
            },
          ]}
        />

        <SplitStatsCard
          title="ROI Global"
          value={
            <span className={metrics.globalROI >= 0 ? 'text-blue-500' : 'text-orange-500'}>
              {formatPercent(metrics.globalROI)}
            </span>
          }
          subValue={<>Invertido: <Amount>{formatCurrency(metrics.totalInvested * usdToEur)}</Amount></>}
          color={metrics.globalROI >= 0 ? 'blue' : 'orange'}
          icon={<BarChartIcon className="w-6 h-6" />}
          segments={[
            {
              label: 'Contado',
              tone: 'spot',
              value: formatPercent(spotMetrics.globalROI),
              valueClassName: pnlClass(spotMetrics.globalROI),
              hint: <>sobre <Amount>{formatCurrency(spotMetrics.totalInvestedEur)}</Amount></>,
            },
            {
              label: 'CFD',
              tone: 'cfd',
              value: formatPercent(leverageMetrics.globalROI),
              valueClassName: pnlClass(leverageMetrics.globalROI),
              hint: <>garantía <Amount>{formatCurrency(leverageMetrics.totalInvestedEur)}</Amount></>,
            },
          ]}
        />

        <SplitStatsCard
          title="Ganancia Media por Trade"
          value={
            <span className={metrics.avgGainPerTrade >= 0 ? 'text-purple-500' : 'text-red-500'}>
              {formatCurrency(metrics.avgGainPerTradeEur)}
            </span>
          }
          subValue="Por operación cerrada"
          sensitive
          color={metrics.avgGainPerTrade >= 0 ? 'purple' : 'red'}
          icon={<TrendingUpIcon className="w-6 h-6" />}
          segments={[
            {
              label: 'Contado',
              tone: 'spot',
              value: formatCurrency(spotMetrics.avgGainPerTradeEur),
              valueClassName: pnlClass(spotMetrics.avgGainPerTrade),
              hint: 'por venta',
            },
            {
              label: 'CFD',
              tone: 'cfd',
              value: formatCurrency(leverageMetrics.avgGainPerTradeEur),
              valueClassName: pnlClass(leverageMetrics.avgGainPerTrade),
              hint: 'por cierre',
            },
          ]}
        />

        <SplitStatsCard
          title="Win Rate"
          value={
            <span className={metrics.winRate >= 50 ? 'text-green-500' : 'text-orange-500'}>
              {formatPercent(metrics.winRate)}
            </span>
          }
          subValue={`${metrics.winningTrades} ganadoras / ${metrics.losingTrades} perdedoras`}
          color={metrics.winRate >= 50 ? 'green' : 'orange'}
          icon={<PercentIcon className="w-6 h-6" />}
          segments={[
            {
              label: 'Contado',
              tone: 'spot',
              value: formatPercent(spotMetrics.winRate),
              valueClassName: spotMetrics.winRate >= 50 ? 'text-green-400' : 'text-orange-400',
              hint: `${spotMetrics.winningTrades} / ${spotMetrics.losingTrades}`,
            },
            {
              label: 'CFD',
              tone: 'cfd',
              value: formatPercent(leverageMetrics.winRate),
              valueClassName: leverageMetrics.winRate >= 50 ? 'text-green-400' : 'text-orange-400',
              hint: `${leverageMetrics.winningTrades} / ${leverageMetrics.losingTrades}${leverageMetrics.liquidations ? ` · ${leverageMetrics.liquidations} liq.` : ''}`,
            },
          ]}
        />

        <SplitStatsCard
          title="Tiempo Posesión Medio"
          color="cyan"
          icon={<ClockIcon className="w-6 h-6" />}
          layout="rows"
          segments={[
            {
              label: 'Contado',
              tone: 'spot',
              value: spotMetrics.totalTrades > 0 ? formatHoldingTime(spotMetrics.avgHoldingDays) : '-',
              valueClassName: 'text-cyan-400',
              hint: `${spotMetrics.totalTrades} ventas · en días`,
            },
            {
              label: 'CFD',
              tone: 'cfd',
              // En CFD se mide de apertura a cierre con minutos: las operaciones duran horas o minutos
              value: leverageMetrics.totalTrades > 0 ? formatDurationMinutes(leverageMetrics.avgHoldingMinutes) : '-',
              valueClassName: 'text-cyan-400',
              hint: `${leverageMetrics.totalTrades} cierres · apertura → cierre`,
            },
          ]}
        />
      </div>

      {/* Gráfico de ganancias realizadas */}
      <RealizedGainsChart data={progression} exchangeRate={data.exchangeRate.eurUsd} />

      {/* Tabla de posiciones cerradas */}
      <ClosedPositionsTable data={closedPositions} />
    </div>
  );
}
