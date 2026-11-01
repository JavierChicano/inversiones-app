'use client';

import { useAuth } from '@/context/AuthContext';
import { useCache } from '@/context/CacheContext';
import { useCallback, useEffect, useState } from 'react';
import { useRefresh } from '@/app/dashboard/layout';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import QuickAddTransaction from '@/components/dashboard/QuickAddTransaction';

const DASHBOARD_CACHE_KEY = 'dashboard-stats';
const DEFAULT_RANGE_DAYS = 30;

export default function DashboardPage() {
  const { token, isAuthenticated } = useAuth();
  const { getCachedData, setCachedData, invalidateCache } = useCache();
  const { refreshVersion } = useRefresh();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(
    async ({ skipCache = false } = {}) => {
      if (!isAuthenticated || !token) return;

      if (!skipCache) {
        const cached = getCachedData(DASHBOARD_CACHE_KEY);
        if (cached) {
          setDashboardData(cached);
          setLoading(false);
          return;
        }
      }

      try {
        setLoading(true);
        const now = new Date();
        const startDate = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          sampleEvery: '1',
          maxSnapshots: '260',
        });

        const response = await fetch(`/api/dashboard/stats?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
          setCachedData(DASHBOARD_CACHE_KEY, data);
        }
      } catch (error) {
        console.error('Error cargando el dashboard:', error);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, token, getCachedData, setCachedData]
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, refreshVersion]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-zinc-400">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {dashboardData ? (
        <DashboardGrid data={dashboardData} />
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">📈</div>
            <h2 className="text-2xl font-bold text-white mb-2">No hay datos disponibles</h2>
            <p className="text-zinc-400 mb-6">
              Comienza agregando tu primera transacción para ver estadísticas de tu portfolio.
            </p>
            <p className="text-zinc-500 text-sm">
              Usa el botón flotante (+) en la esquina inferior derecha para agregar una transacción.
            </p>
          </div>
        </div>
      )}

      <QuickAddTransaction
        onTransactionAdded={() => {
          invalidateCache(DASHBOARD_CACHE_KEY);
          fetchDashboardData({ skipCache: true });
        }}
      />
    </>
  );
}
