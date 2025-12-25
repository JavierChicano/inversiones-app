'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCache } from '@/context/CacheContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook personalizado para obtener datos con caché automático
 * @param {string} cacheKey - Clave única para el caché
 * @param {Function} fetchFunction - Función async que obtiene los datos
 * @param {Array} dependencies - Dependencias para recargar (similar a useEffect)
 * @returns {Object} { data, loading, error, refetch }
 */
export function useCachedData(cacheKey, fetchFunction, dependencies = []) {
  const { getCachedData, setCachedData } = useCache();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    // Intentar obtener datos del caché primero
    const cached = getCachedData(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchFunction();
      setData(result);
      // Guardar en caché
      setCachedData(cacheKey, result);
    } catch (err) {
      console.error(`Error fetching ${cacheKey}:`, err);
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetchFunction, getCachedData, setCachedData]);

  useEffect(() => {
    fetchData();
  }, dependencies);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
