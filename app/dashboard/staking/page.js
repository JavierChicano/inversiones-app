'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCache } from '@/context/CacheContext';
import StatsCard from '@/components/dashboard/StatsCard';
import AddStakingPositionModal from '@/components/dashboard/AddStakingPositionModal';
import StakingPositionsTable from '@/components/dashboard/StakingPositionsTable';
import StakingHistoryTable from '@/components/dashboard/StakingHistoryTable';
import UnstakeStakingModal from '@/components/dashboard/UnstakeStakingModal';
import {
  CoinStackIcon,
  LockIcon,
  PercentIcon,
  PlusIcon,
} from '@/components/icons';

function formatCoin(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value) || 0);
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function StakingHubPage() {
  const { token } = useAuth();
  const { getCachedData, setCachedData, invalidateCache } = useCache();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState({
    summary: {
      totalCryptoOwned: 0,
      totalStaked: 0,
      stakedPercentage: 0,
      totalCryptoUsdValue: 0,
      totalStakedUsdValue: 0,
      ownedByTicker: [],
      stakedByTicker: [],
    },
    positions: [],
    history: [],
    availableCryptos: [],
  });
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [isUnstakeModalOpen, setIsUnstakeModalOpen] = useState(false);

  const fetchStakingData = async (skipCache = false) => {
    if (!token) return;

    if (!skipCache) {
      const cached = getCachedData('staking-hub');
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/staking', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar Staking Hub');
      }

      const responseData = await response.json();
      setData(responseData);
      setCachedData('staking-hub', responseData);
    } catch (fetchError) {
      console.error(fetchError);
      setError(fetchError.message || 'Error cargando datos de staking');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePosition = async (payload) => {
    const response = await fetch('/api/staking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'No fue posible crear la posición');
    }

    invalidateCache('staking-hub');
    invalidateCache('dashboard-stats');
    await fetchStakingData(true);
  };

  const handleUnstake = (position) => {
    setSelectedPosition(position);
    setIsUnstakeModalOpen(true);
  };

  const handleUnstakeSubmit = async (payload) => {
    if (!selectedPosition) return;

    const response = await fetch(`/api/staking/${selectedPosition.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'No fue posible retirar el staking');
    }

    invalidateCache('staking-hub');
    invalidateCache('dashboard-stats');
    await fetchStakingData(true);
    setSelectedPosition(null);
  };

  useEffect(() => {
    fetchStakingData();
  }, [token]);

  const totals = useMemo(() => {
    const annualUsd = (data.positions || []).reduce(
      (sum, position) => sum + (position.projection?.annual?.usd || 0),
      0
    );

    return {
      annualUsd,
    };
  }, [data.positions]);

  const ownedByTickerLabel = useMemo(() => {
    const items = data.summary.ownedByTicker || [];
    if (!items.length) return 'Sin posiciones de cripto';
    return items
      .slice(0, 4)
      .map((item) => `${item.ticker}: ${formatCoin(item.quantity)}`)
      .join(' | ');
  }, [data.summary.ownedByTicker]);

  const stakedByTickerLabel = useMemo(() => {
    const items = data.summary.stakedByTicker || [];
    if (!items.length) return 'Sin staking activo';
    return items
      .slice(0, 4)
      .map((item) => `${item.ticker}: ${formatCoin(item.amountStaked)}`)
      .join(' | ');
  }, [data.summary.stakedByTicker]);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500"></div>
        <p className="text-zinc-400">Cargando Staking Hub...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
        <h2 className="text-lg font-semibold text-red-300">Error cargando Staking Hub</h2>
        <p className="mt-2 text-sm text-red-200/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-900/60 bg-linear-to-r from-zinc-900 via-zinc-900 to-cyan-950/40 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Staking Hub</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Monitoriza tus posiciones bloqueadas y estima ganancias en token y USD.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/30"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva posición
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatsCard
          title="Cripto en posesión"
          value={formatUsd(data.summary.totalCryptoUsdValue)}
          subValue={ownedByTickerLabel}
          icon={<CoinStackIcon className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          title="Actualmente en staking"
          value={formatUsd(data.summary.totalStakedUsdValue)}
          subValue={stakedByTickerLabel}
          icon={<LockIcon className="h-5 w-5" />}
          color="indigo"
        />
        <StatsCard
          title="% de cripto en staking"
          value={`${Number(data.summary.stakedPercentage || 0).toFixed(2)}%`}
          subValue={`Proyección anual: ${formatUsd(totals.annualUsd)}`}
          icon={<PercentIcon className="h-5 w-5" />}
          color="green"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Posiciones activas</h3>
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            {(data.positions || []).length} posiciones
          </span>
        </div>
        <StakingPositionsTable positions={data.positions} onUnstake={handleUnstake} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Historial de staking</h3>
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            {(data.history || []).length} eventos
          </span>
        </div>
        <StakingHistoryTable history={data.history} />
      </section>

      <AddStakingPositionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePosition}
        assets={data.availableCryptos || []}
        holdings={data.summary.ownedByTicker || []}
      />

      <UnstakeStakingModal
        isOpen={isUnstakeModalOpen}
        onClose={() => setIsUnstakeModalOpen(false)}
        onSubmit={handleUnstakeSubmit}
        position={selectedPosition}
      />
    </div>
  );
}
