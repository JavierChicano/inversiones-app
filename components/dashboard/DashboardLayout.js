'use client';

import { useAuth } from '@/context/AuthContext';
import { useCache } from '@/context/CacheContext';
import { useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

const RefreshContext = createContext();

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh debe ser usado dentro de DashboardLayout');
  }
  return context;
}

export default function DashboardLayout({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { invalidateAllDashboardData } = useCache();
  const router = useRouter();

  const handleRefresh = () => {
    invalidateAllDashboardData();
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-zinc-400">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <p className="text-zinc-400">Redirigiendo...</p>
          </div>
        </div>
      </div>
    );
  }

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
