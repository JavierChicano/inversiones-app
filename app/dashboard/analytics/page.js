'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatHoldingTimeLong } from '@/lib/utils/formatters';
import StatsCard from '@/components/dashboard/StatsCard';
import RealizedGainsChart from '@/components/dashboard/RealizedGainsChart';
import ClosedPositionsTable from '@/components/dashboard/ClosedPositionsTable';
import { TrendingUpIcon, PercentIcon, BarChartIcon, CashIcon, ClockIcon } from '@/components/icons';

export default function AnalyticsPage() {
  const { token } = useAuth();
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
  }, [token]);

  const formatCurrency = (value, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

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
            No hay posiciones cerradas aún. Las operaciones de venta aparecerán aquí.
          </p>
        </div>
      </div>
    );
  }

  const { metrics, closedPositions, progression } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Análisis de Posiciones Cerradas</h2>
        <p className="text-zinc-400">
          Rendimiento histórico de tus operaciones completadas (compra → venta)
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Ganancia Total Realizada"
          value={
            <span className={metrics.totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}>
              {formatCurrency(metrics.totalGainLossEur)}
            </span>
          }
          subValue={`${metrics.totalTrades} operaciones en ${metrics.totalTickers} tickers`}
          color={metrics.totalGainLoss >= 0 ? 'green' : 'red'}
          icon={<CashIcon className="w-6 h-6" />}
        />

        <StatsCard
          title="ROI Global"
          value={
            <span className={metrics.globalROI >= 0 ? 'text-blue-500' : 'text-orange-500'}>
              {formatPercent(metrics.globalROI)}
            </span>
          }
          subValue={`Invertido: ${formatCurrency(metrics.totalInvested * (1 / data.exchangeRate.eurUsd))}`}
          color={metrics.globalROI >= 0 ? 'blue' : 'orange'}
          icon={<BarChartIcon className="w-6 h-6" />}
        />

        <StatsCard
          title="Ganancia Media por Trade"
          value={
            <span className={metrics.avgGainPerTrade >= 0 ? 'text-purple-500' : 'text-red-500'}>
              {formatCurrency(metrics.avgGainPerTradeEur)}
            </span>
          }
          subValue="Por operación cerrada"
          color={metrics.avgGainPerTrade >= 0 ? 'purple' : 'red'}
          icon={<TrendingUpIcon className="w-6 h-6" />}
        />

        <StatsCard
          title="Win Rate"
          value={
            <span className={metrics.winRate >= 50 ? 'text-green-500' : 'text-orange-500'}>
              {formatPercent(metrics.winRate)}
            </span>
          }
          subValue={`${metrics.winningTrades} ganadoras / ${metrics.losingTrades} perdedoras`}
          color={metrics.winRate >= 50 ? 'green' : 'orange'}
          icon={<PercentIcon className="w-6 h-6" />}
        />

        <StatsCard
          title="Tiempo Posesión Medio"
          value={
            <span className="text-cyan-500">
              {formatHoldingTimeLong(metrics.avgHoldingDays)}
            </span>
          }
          subValue="De activos vendidos"
          color="cyan"
          icon={<ClockIcon className="w-6 h-6" />}
        />
      </div>

      {/* Gráfico de ganancias realizadas */}
      <RealizedGainsChart data={progression} />

      {/* Tabla de posiciones cerradas */}
      <ClosedPositionsTable data={closedPositions} />
    </div>
  );
}
