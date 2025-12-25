"use client";
import QuickAddTransaction from "@/components/dashboard/QuickAddTransaction";
import { useEffect, useState } from "react";
import TransactionsTable from "@/components/dashboard/TransactionsTable";
import { useAuth } from "@/context/AuthContext";
import { useCache } from "@/context/CacheContext";

export default function TransactionsPage() {
  const { token } = useAuth();
  const { getCachedData, setCachedData, invalidateCache } = useCache();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div className="space-y-6">
        <QuickAddTransaction onTransactionAdded={() => {
          invalidateCache('transactions');
          invalidateCache('dashboard-stats');
          fetchTransactions();
        }} />

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

        {!loading && !error && <TransactionsTable data={transactions} onTransactionUpdated={() => {
          invalidateCache('ttrue); // Forzar recarga sin cachénsactions');
          invalidateCache('dashboard-stats');
          fetchTransactions();
        }} />}
      </div>
  );
}
