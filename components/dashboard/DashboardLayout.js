'use client';

import { useCache } from '@/context/CacheContext';
import { createContext, useContext } from 'react';

const RefreshContext = createContext();

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh debe ser usado dentro de DashboardLayout');
  }
  return context;
}

export default function DashboardLayout({ children }) {
  const { invalidateAllDashboardData } = useCache();

  const handleRefresh = () => {
    invalidateAllDashboardData();
  };

  return (
    <RefreshContext.Provider value={{ handleRefresh }}>
      <div className="min-h-screen bg-background">
        <main className="max-w-480 mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </RefreshContext.Provider>
  );
}
