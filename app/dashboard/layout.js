'use client';

import { useCache } from '@/context/CacheContext';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import DashboardNav from '@/components/dashboard/DashboardNav';

const RefreshContext = createContext(null);

/**
 * `handleRefresh` vacía la caché y aumenta `refreshVersion`; las páginas lo incluyen en las
 * dependencias de su efecto de carga para volver a pedir datos sin recargar la página.
 */
export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh debe ser usado dentro de DashboardLayout');
  }
  return context;
}

export default function DashboardLayout({ children }) {
  const { invalidateAllDashboardData } = useCache();
  const [refreshVersion, setRefreshVersion] = useState(0);

  const handleRefresh = useCallback(() => {
    invalidateAllDashboardData();
    setRefreshVersion((version) => version + 1);
  }, [invalidateAllDashboardData]);

  const value = useMemo(() => ({ handleRefresh, refreshVersion }), [handleRefresh, refreshVersion]);

  return (
    <RefreshContext.Provider value={value}>
      <div className="min-h-screen bg-background">
        <main className="max-w-480 mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav />
          {children}
        </main>
      </div>
    </RefreshContext.Provider>
  );
}
