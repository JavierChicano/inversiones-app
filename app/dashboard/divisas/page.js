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
            className="btn-secondary rounded-lg flex items-center gap-2"
          >
            <RefreshIcon className="w-5 h-5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {summary && currentRates && (() => {
        // Calcular NETO total (solo EUR→USD abiertos)
        const eurToUsdExchanges = exchanges.filter(e => e.fromCurrency === 'EUR');
        const totalNetGain = eurToUsdExchanges.reduce((sum, exchange) => sum + exchange.difference, 0);
        const totalInvested = eurToUsdExchanges.reduce((sum, exchange) => sum + exchange.amount, 0);
        const netPercentage = totalInvested > 0 ? (totalNetGain / totalInvested) * 100 : 0;
        
        // Calcular balance de divisas
        // Dinero invertido: EUR que se convirtieron a USD
        const moneyInvested = exchanges
          .filter(e => e.fromCurrency === 'EUR')
          .reduce((sum, e) => sum + e.amount, 0);
        
        // Dinero retirado: USD convertidos a EUR usando el tipo histórico de cada transacción
        const moneyWithdrawnInEur = exchanges
          .filter(e => e.fromCurrency === 'USD')
          .reduce((sum, e) => sum + (e.amount * e.exchangeRate), 0);

        const totalOperations = summary.eurToUsd.count + summary.usdToEur.count;

        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <StatsCard
                title="NETO"
                value={`${totalNetGain >= 0 ? '+' : ''}${totalNetGain.toFixed(2)} €`}
                subValue={`${netPercentage >= 0 ? '+' : ''}${netPercentage.toFixed(2)}%`}
                icon={<CurrencyIcon className="w-5 h-5" />}
                color={totalNetGain >= 0 ? "green" : "red"}
                valueClassName={totalNetGain >= 0 ? "text-green-400" : "text-red-400"}
              />
              <StatsCard
                title="Operaciones"
                value={`${totalOperations} operaciones`}
                subValue={`${summary.eurToUsd.count} EUR→USD · ${summary.usdToEur.count} USD→EUR`}
                icon={<CurrencyIcon className="w-5 h-5" />}
                color="green"
              />
              <StatsCard
                title="Tipo Actual EUR/USD"
                value={currentRates.eurToUsd.toFixed(4)}
                subValue={`USD/EUR: ${currentRates.usdToEur.toFixed(4)}`}
                icon={<CurrencyIcon className="w-5 h-5" />}
                color="blue"
              />

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 xl:col-span-2">
                <h3 className="text-zinc-400 text-sm font-medium mb-4">Balance Divisas</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-zinc-400 text-sm font-medium mb-2">📥 Invertido</div>
                    <div className="text-2xl lg:text-3xl font-bold text-blue-400">
                      {moneyInvested.toFixed(2)} €
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-400 text-sm font-medium mb-2">📤 Retirado</div>
                    <div className="text-2xl lg:text-3xl font-bold text-orange-400">
                      {moneyWithdrawnInEur.toFixed(2)} €
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
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
