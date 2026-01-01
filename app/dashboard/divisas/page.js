"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCache } from "@/context/CacheContext";
import CurrencyExchangesTable from "@/components/dashboard/CurrencyExchangesTable";
import QuickAddCurrencyExchange from "@/components/dashboard/QuickAddCurrencyExchange";
import EditCurrencyExchangeModal from "@/components/dashboard/EditCurrencyExchangeModal";
import StatsCard from "@/components/dashboard/StatsCard";
import { RefreshIcon, CurrencyIcon } from "@/components/icons";

export default function DivisasPage() {
  const { token } = useAuth();
  const { getCachedData, setCachedData } = useCache();
  const [exchanges, setExchanges] = useState([]);
  const [summary, setSummary] = useState(null);
  const [currentRates, setCurrentRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editModalData, setEditModalData] = useState(null);

  const fetchExchanges = async (skipCache = false) => {
    if (!token) return;

    if (!skipCache) {
      const cached = getCachedData("currency-exchanges");
      if (cached) {
        setExchanges(cached.exchanges || []);
        setSummary(cached.summary || null);
        setCurrentRates(cached.currentRate || null);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await fetch("/api/currency-exchanges", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Error al cargar cambios de divisa");
      }

      const data = await response.json();
      setExchanges(data.exchanges || []);
      setSummary(data.summary || null);
      setCurrentRates(data.currentRate || null);
      setCachedData("currency-exchanges", data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExchanges();
  }, [token]);

  const handleDelete = async (id) => {
    if (!confirm("¿Estás seguro de eliminar este cambio de divisa?")) {
      return;
    }

    try {
      const response = await fetch(`/api/currency-exchanges/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Error al eliminar cambio de divisa");
      }

      await fetchExchanges(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (exchange) => {
    setEditModalData(exchange);
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Gestión de Divisas
          </h1>
          <p className="text-zinc-400 mt-1">
            Controla tus cambios de EUR-USD y analiza tu rendimiento
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchExchanges(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            <RefreshIcon className="w-5 h-5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {summary && currentRates && (() => {
        // Calcular NETO total
        const totalNetGain = exchanges.reduce((sum, exchange) => sum + exchange.difference, 0);
        const totalInvested = exchanges.reduce((sum, exchange) => {
          return sum + (exchange.fromCurrency === 'EUR' ? exchange.amount : 0);
        }, 0);
        const netPercentage = totalInvested > 0 ? (totalNetGain / totalInvested) * 100 : 0;

        return (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatsCard
              title="NETO"
              value={`${totalNetGain >= 0 ? '+' : ''}${totalNetGain.toFixed(2)} €`}
              subValue={`${netPercentage >= 0 ? '+' : ''}${netPercentage.toFixed(2)}%`}
              icon={<CurrencyIcon className="w-5 h-5" />}
              color={totalNetGain >= 0 ? "green" : "red"}
            />
            <StatsCard
              title="Total de Cambios"
              value={summary.totalExchanges}
              icon={<CurrencyIcon className="w-5 h-5" />}
              color="purple"
            />
            <StatsCard
              title="EUR → USD"
              value={`${summary.eurToUsd.count} operaciones`}
              subValue={`${summary.eurToUsd.totalAmountEur.toFixed(2)} EUR cambiados`}
              icon={<CurrencyIcon className="w-5 h-5" />}
              color="green"
            />
            <StatsCard
              title="USD → EUR"
              value={`${summary.usdToEur.count} operaciones`}
              subValue={`${summary.usdToEur.totalAmountUsd.toFixed(2)} USD cambiados`}
              icon={<CurrencyIcon className="w-5 h-5" />}
              color="orange"
            />
            <StatsCard
              title="Tipo Actual EUR/USD"
              value={currentRates.eurToUsd.toFixed(4)}
              subValue={`USD/EUR: ${currentRates.usdToEur.toFixed(4)}`}
              icon={<CurrencyIcon className="w-5 h-5" />}
              color="blue"
            />
          </div>
        );
      })()}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Tabla */}
      <CurrencyExchangesTable
        exchanges={exchanges}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />

      <QuickAddCurrencyExchange onExchangeAdded={() => fetchExchanges(true)} />

      <EditCurrencyExchangeModal
        exchange={editModalData}
        onClose={() => setEditModalData(null)}
        onSuccess={() => {
          setEditModalData(null);
          fetchExchanges(true);
        }}
      />
    </div>
  );
}
