'use client';

import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

const CacheContext = createContext(null);

export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
export const PROGRESSION_CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

/**
 * Caché en memoria de respuestas de la API con TTL por clave.
 *
 * Se guarda en un ref (no en estado): escribir en la caché no provoca re-renders de toda
 * la app y las funciones expuestas son estables, así que pueden usarse como dependencias
 * de useEffect/useCallback sin disparar recargas. La expiración se comprueba al leer.
 */
export function CacheProvider({ children }) {
  const store = useRef(new Map());

  const getCachedData = useCallback((key) => {
    const entry = store.current.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp < entry.ttl) {
      return entry.data;
    }

    store.current.delete(key);
    return null;
  }, []);

  const setCachedData = useCallback((key, data, ttl = CACHE_DURATION) => {
    store.current.set(key, { data, timestamp: Date.now(), ttl });
  }, []);

  const invalidateCache = useCallback((key) => {
    if (key) {
      store.current.delete(key);
    } else {
      store.current.clear();
    }
  }, []);

  // Tras refrescar precios, cualquier dato cacheado (stats, progresión, divisas, staking...) está obsoleto
  const invalidateAllDashboardData = useCallback(() => {
    store.current.clear();
  }, []);

  const value = useMemo(
    () => ({
      getCachedData,
      setCachedData,
      invalidateCache,
      invalidateAllDashboardData,
      PROGRESSION_CACHE_DURATION,
    }),
    [getCachedData, setCachedData, invalidateCache, invalidateAllDashboardData]
  );

  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>;
}

export function useCache() {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache debe ser usado dentro de un CacheProvider');
  }
  return context;
}
