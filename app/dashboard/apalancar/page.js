'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRefresh } from '@/app/dashboard/layout';
import { useAuth } from '@/context/AuthContext';
import { useCache } from '@/context/CacheContext';
import StatsCard from '@/components/dashboard/StatsCard';
import Amount from '@/components/Amount';
import AddLeveragedPositionModal from '@/components/dashboard/AddLeveragedPositionModal';
import CloseLeveragedPositionModal from '@/components/dashboard/CloseLeveragedPositionModal';
import EditLeveragedPositionModal from '@/components/dashboard/EditLeveragedPositionModal';
import LeveragedPositionsTable from '@/components/dashboard/LeveragedPositionsTable';
import LeveragedHistoryTable from '@/components/dashboard/LeveragedHistoryTable';
import { CashIcon, LeverageIcon, PlusIcon, TargetIcon, TrendingUpIcon } from '@/components/icons';
import { formatPercent, formatSignedPercent, formatUsd } from '@/lib/utils/formatters';

const CACHE_KEY = 'leverage-hub';

const EMPTY_DATA = {
  summary: {
    openCount: 0,
    closedCount: 0,
    marginInvested: 0,
    totalExposure: 0,
    unrealizedNetPnl: 0,
    unrealizedRoi: 0,
    realizedNetPnl: 0,
    winRate: 0,
    liquidations: 0,
    maxLiquidationProximity: 0,
    positionsAtRisk: 0,
  },
  openPositions: [],
  closedPositions: [],
  config: { liquidationLevel: 0.5 },
};

function riskColor(proximity) {
  if (proximity >= 75) return 'red';
  if (proximity >= 50) return 'orange';
  return 'green';
}

export default function ApalancarPage() {
  const { token } = useAuth();
  const { refreshVersion } = useRefresh();
  const { getCachedData, setCachedData, invalidateCache } = useCache();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [closingPosition, setClosingPosition] = useState(null);
  const [editingPosition, setEditingPosition] = useState(null);

  const fetchData = useCallback(
    async (skipCache = false) => {
      if (!token) return;

      if (!skipCache) {
        const cached = getCachedData(CACHE_KEY);
        if (cached) {
          setData(cached);
          setLoading(false);
          return;
        }
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/leverage', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) {
          throw new Error('No se pudieron cargar las posiciones apalancadas');
        }
        const responseData = await response.json();
        setData(responseData);
        setCachedData(CACHE_KEY, responseData);
      } catch (fetchError) {
        console.error(fetchError);
        setError(fetchError.message || 'Error cargando posiciones apalancadas');
      } finally {
        setLoading(false);
      }
    },
    [token, getCachedData, setCachedData]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshVersion]);

  const request = useCallback(
    async (path, { method = 'GET', body } = {}, fallbackError) => {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || fallbackError);
      }

      invalidateCache(CACHE_KEY);
      invalidateCache('dashboard-stats');
      await fetchData(true);
      return response;
    },
    [token, invalidateCache, fetchData]
  );

  const handleCreate = (payload) => request('/api/leverage', { method: 'POST', body: payload }, 'No fue posible abrir la posición');

  const handleClose = async (payload) => {
    if (!closingPosition) return;
    await request(`/api/leverage/${closingPosition.id}/close`, { method: 'POST', body: payload }, 'No fue posible cerrar la posición');
    setClosingPosition(null);
  };

  const handleUpdate = async (payload) => {
    if (!editingPosition) return;
    await request(`/api/leverage/${editingPosition.id}`, { method: 'PUT', body: payload }, 'No fue posible actualizar la posición');
    setEditingPosition(null);
  };

  const handleDelete = async (position) => {
    const label = position.status === 'CLOSED' ? 'del historial' : 'abierta';
    if (!window.confirm(`¿Eliminar la posición ${label} de ${position.assetTicker}? Esta acción no se puede deshacer.`)) return;

    try {
      await request(`/api/leverage/${position.id}`, { method: 'DELETE' }, 'No fue posible eliminar la posición');
    } catch (deleteError) {
      console.error(deleteError);
      window.alert(deleteError.message);
    }
  };

  const { summary } = data;
  const unrealizedPositive = summary.unrealizedNetPnl >= 0;
  const realizedPositive = summary.realizedNetPnl >= 0;
  const maxProximity = Number(summary.maxLiquidationProximity || 0);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500"></div>
        <p className="text-zinc-400">Cargando posiciones apalancadas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
        <h2 className="text-lg font-semibold text-red-300">Error cargando Apalancar</h2>
        <p className="mt-2 text-sm text-red-200/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-fuchsia-900/60 bg-linear-to-r from-zinc-900 via-zinc-900 to-fuchsia-950/40 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              <LeverageIcon className="h-7 w-7 text-fuchsia-300" />
              Apalancar
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              CFDs y operativa con margen: largos y cortos, swap nocturno, P&amp;L neto sobre la garantía y riesgo de
              liquidación al {formatPercent((data.config?.liquidationLevel || 0.5) * 100, 0)} de la garantía.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-500/30"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva posición
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Garantía invertida"
          value={formatUsd(summary.marginInvested)}
          subValue={`Exposición: ${formatUsd(summary.totalExposure)} · ${summary.openCount} ${summary.openCount === 1 ? 'posición abierta' : 'posiciones abiertas'}`}
          sensitive
          icon={<CashIcon className="h-5 w-5" />}
          color="purple"
        />
        <StatsCard
          title="P&L latente (neto)"
          value={
            <span className={unrealizedPositive ? 'text-green-500' : 'text-red-500'}>
              <Amount>{formatUsd(summary.unrealizedNetPnl)}</Amount>
            </span>
          }
          subValue={`ROI sobre garantía: ${formatSignedPercent(summary.unrealizedRoi)} · swap devengado ${formatUsd(summary.swapAccrued || 0)}`}
          icon={<TrendingUpIcon className="h-5 w-5" />}
          color={unrealizedPositive ? 'green' : 'red'}
        />
        <StatsCard
          title="P&L realizado (neto)"
          value={
            <span className={realizedPositive ? 'text-green-500' : 'text-red-500'}>
              <Amount>{formatUsd(summary.realizedNetPnl)}</Amount>
            </span>
          }
          subValue={`${summary.closedCount} cerradas · win rate ${formatPercent(summary.winRate, 0)} · ${summary.liquidations} liquidaciones`}
          icon={<LeverageIcon className="h-5 w-5" />}
          color={realizedPositive ? 'green' : 'red'}
        />
        <StatsCard
          title="Riesgo de liquidación"
          value={summary.openCount > 0 ? formatPercent(maxProximity, 0) : '-'}
          subValue={
            summary.openCount > 0
              ? `Peor posición · ${summary.positionsAtRisk} en zona de peligro (≥ 75 %)`
              : 'Sin posiciones abiertas'
          }
          icon={<TargetIcon className="h-5 w-5" />}
          color={summary.openCount > 0 ? riskColor(maxProximity) : 'blue'}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Posiciones abiertas</h3>
          <span className="text-xs uppercase tracking-wide text-zinc-500">{data.openPositions.length} posiciones</span>
        </div>
        <LeveragedPositionsTable
          positions={data.openPositions}
          onClose={setClosingPosition}
          onEdit={setEditingPosition}
          onDelete={handleDelete}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Historial de cierres</h3>
          <span className="text-xs uppercase tracking-wide text-zinc-500">{data.closedPositions.length} cerradas</span>
        </div>
        <LeveragedHistoryTable positions={data.closedPositions} onDelete={handleDelete} />
      </section>

      <AddLeveragedPositionModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onSubmit={handleCreate} />

      {/* La key remonta el modal al cambiar de posición: el formulario arranca con los datos de esa posición */}
      <CloseLeveragedPositionModal
        key={`close-${closingPosition?.id ?? 'none'}`}
        isOpen={!!closingPosition}
        position={closingPosition}
        onClose={() => setClosingPosition(null)}
        onSubmit={handleClose}
      />

      <EditLeveragedPositionModal
        key={`edit-${editingPosition?.id ?? 'none'}`}
        isOpen={!!editingPosition}
        position={editingPosition}
        onClose={() => setEditingPosition(null)}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
