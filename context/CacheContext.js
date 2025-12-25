'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

const CacheContext = createContext();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export function CacheProvider({ children }) {
  const [cache, setCache] = useState({});
  const timersRef = useRef({});

  const getCachedData = useCallback((key) => {
    const cached = cache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, [cache]);

  const setCachedData = useCallback((key, data) => {
    setCache(prev => ({
      ...prev,
      [key]: {
        data,
        timestamp: Date.now(),
      },
    }));

    // Limpiar el temporizador anterior si existe
    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key]);
    }

    // Configurar auto-invalidación después de CACHE_DURATION
    timersRef.current[key] = setTimeout(() => {
      invalidateCache(key);
    }, CACHE_DURATION);
  }, []);

  const invalidateCache = useCallback((key) => {
    if (key) {
      // Invalidar una clave específica
      setCache(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
      
      if (timersRef.current[key]) {
        clearTimeout(timersRef.current[key]);
        delete timersRef.current[key];
      }
    } else {
      // Invalidar toda la caché
      setCache({});
      Object.values(timersRef.current).forEach(timer => clearTimeout(timer));
      timersRef.current = {};
    }
  }, []);

  const invalidateAllDashboardData = useCallback(() => {
    // Invalidar todas las claves relacionadas con el dashboard
    const dashboardKeys = ['dashboard-stats', 'transactions', 'portfolio-positions'];
    dashboardKeys.forEach(key => invalidateCache(key));
  }, [invalidateCache]);

  const value = {
    getCachedData,
    setCachedData,
    invalidateCache,
    invalidateAllDashboardData,
  };

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
}

export function useCache() {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache debe ser usado dentro de un CacheProvider');
  }
  return context;
}
