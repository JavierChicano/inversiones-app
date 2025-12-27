"use client";
import QuickAddTransaction from "@/components/dashboard/QuickAddTransaction";
import { useEffect, useState, useMemo } from "react";
import TransactionsTable from "@/components/dashboard/TransactionsTable";
import { useAuth } from "@/context/AuthContext";
import { useCache } from "@/context/CacheContext";
import { FilterIcon, ChevronDownIcon, ChevronUpIcon } from "@/components/icons";

export default function TransactionsPage() {
  const { token } = useAuth();
  const { getCachedData, setCachedData, invalidateCache } = useCache();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados de filtros
  const [filterType, setFilterType] = useState('all'); 
  const [filterTicker, setFilterTicker] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchTransactions = async (skipCache = false) => {
    if (!token) return;

    // Intentar obtener datos del caché primero (solo si no se salta)
    if (!skipCache) {
      const cached = getCachedData('transactions');
      if (cached) {
        setTransactions(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await fetch("/api/transactions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Error al cargar transacciones");
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
      // Guardar en caché
      setCachedData('transactions', data.transactions || []);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [token]);

  // Obtener lista única de tickers para el filtro
  const uniqueTickers = useMemo(() => {
    const tickers = [...new Set(transactions.map(t => t.assetTicker))];
    return tickers.sort();
  }, [transactions]);

  // Filtrar transacciones
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Filtrar por tipo
    if (filterType !== 'all') {
      result = result.filter(t => t.type === filterType);
    }

    // Filtrar por ticker
    if (filterTicker) {
      result = result.filter(t => 
        t.assetTicker.toLowerCase().includes(filterTicker.toLowerCase())
      );
    }

    // Filtrar por fecha desde
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      result = result.filter(t => new Date(t.date) >= fromDate);
    }

    // Filtrar por fecha hasta
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999); // Incluir todo el día
      result = result.filter(t => new Date(t.date) <= toDate);
    }

    return result;
  }, [transactions, filterType, filterTicker, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterType('all');
    setFilterTicker('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div className="space-y-6">
        <QuickAddTransaction onTransactionAdded={() => {
          invalidateCache('transactions');
          invalidateCache('dashboard-stats');
          fetchTransactions();
        }} />

        {/* Sección de Filtros */}
        {!loading && !error && transactions.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FilterIcon className="w-5 h-5 text-blue-400" />
                <h3 className="text-white text-lg font-semibold">Filtros</h3>
              </div>
              <div className="flex items-center gap-3">
                {showFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    Limpiar filtros
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm"
                >
                  {showFilters ? (
                    <>
                      <ChevronUpIcon className="w-4 h-4" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon className="w-4 h-4" />
                      Mostrar
                    </>
                  )}
                </button>
              </div>
            </div>

            {showFilters && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  {/* Filtro por tipo */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Tipo de Operación</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Todas</option>
                      <option value="BUY">Compras</option>
                      <option value="SELL">Ventas</option>
                    </select>
                  </div>

              {/* Filtro por ticker */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Ticker</label>
                <input
                  type="text"
                  value={filterTicker}
                  onChange={(e) => setFilterTicker(e.target.value)}
                  placeholder="Buscar ticker..."
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-zinc-500"
                />
              </div>

              {/* Filtro fecha desde */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Desde</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filtro fecha hasta */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Hasta</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Contador de resultados */}
            <div className="mt-4 text-sm text-zinc-400">
              Mostrando <span className="text-white font-semibold">{filteredTransactions.length}</span> de <span className="text-white font-semibold">{transactions.length}</span> transacciones
            </div>
            </>
            )}
          </div>
        )}

        {loading && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-zinc-400 mt-4">Cargando transacciones...</p>
          </div>
        )}

        {error && (
          <>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Transacciones
              </h2>
              <p className="text-zinc-400">
                Historial completo de tus operaciones de compra y venta,
                ordenadas de más reciente a más antiguo.
              </p>
            </div>
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6">
              <p className="text-red-400">⚠️ {error}</p>
            </div>
          </>
        )}

        {!loading && !error && <TransactionsTable data={filteredTransactions} onTransactionUpdated={() => {
          invalidateCache('transactions');
          invalidateCache('dashboard-stats');
          fetchTransactions();
        }} />}
      </div>
  );
}
