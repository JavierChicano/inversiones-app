'use client';

import { useAuth } from '@/context/AuthContext';
import { useCache } from '@/context/CacheContext';
import { useEffect, useState } from 'react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import QuickAddTransaction from '@/components/dashboard/QuickAddTransaction';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { getCachedData, setCachedData, invalidateCache } = useCache();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!isAuthenticated || !user) return;

    // Intentar obtener datos del caché primero
    const cached = getCachedData('dashboard-stats');
    if (cached) {
      setDashboardData(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/api/dashboard/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
        // Guardar en caché
        setCachedData('dashboard-stats', data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [isAuthenticated, user]);

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
              <h2 className="text-2xl font-bold text-white mb-2">
                No hay datos disponibles
              </h2>
              <p className="text-zinc-400 mb-6">
                Comienza agregando tu primera transacción para ver estadísticas de tu portfolio.
              </p>
              <p className="text-zinc-500 text-sm">
                Usa el botón flotante (+) en la esquina inferior derecha para agregar una transacción.
              </p>
            </div>
          </div>
        )}

      <QuickAddTransaction onTransactionAdded={() => {
        invalidateCache('dashboard-stats');
        fetchDashboardData();
      }} />
    </>
  );
}
