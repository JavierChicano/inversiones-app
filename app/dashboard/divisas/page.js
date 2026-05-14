"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCache } from "@/context/CacheContext";
import CurrencyExchangesTable from "@/components/dashboard/CurrencyExchangesTable";
import QuickAddCurrencyExchange from "@/components/dashboard/QuickAddCurrencyExchange";
import EditCurrencyExchangeModal from "@/components/dashboard/EditCurrencyExchangeModal";
import StatsCard from "@/components/dashboard/StatsCard";
import { RefreshIcon, CurrencyIcon, TrendingUpIcon, TrendingDownIcon, ChartIcon } from "@/components/icons";
import { calculateCurrencyExchangeMetrics } from "@/lib/utils/currencyExchangeMetrics";

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

    const exchangeMetrics = currentRates
      ? calculateCurrencyExchangeMetrics(exchanges, currentRates.eurToUsd)
      : null;

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
      {summary && currentRates && exchangeMetrics && (() => {
        const totalOperations = summary.eurToUsd.count + summary.usdToEur.count;
        const realizedCount = summary.usdToEur.count;
        const openCount = summary.eurToUsd.count;
        const pendingEur = Math.max(exchangeMetrics.summary.investedEur - exchangeMetrics.summary.recoveredEur, 0);
        const recoveryWidth = Math.max(0, Math.min(exchangeMetrics.summary.recoveryRate, 100));

        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <StatsCard
                title="NETO"
                value={`${exchangeMetrics.summary.totalNetEur >= 0 ? '+' : ''}${exchangeMetrics.summary.totalNetEur.toFixed(2)} €`}
                subValue={`Abierto: ${exchangeMetrics.summary.openUnrealizedEur >= 0 ? '+' : ''}${exchangeMetrics.summary.openUnrealizedEur.toFixed(2)} € · Realizado: ${exchangeMetrics.summary.realizedNetEur >= 0 ? '+' : ''}${exchangeMetrics.summary.realizedNetEur.toFixed(2)} €`}
                icon={<CurrencyIcon className="w-5 h-5" />}
                color={exchangeMetrics.summary.totalNetEur >= 0 ? "green" : "red"}
                valueClassName={exchangeMetrics.summary.totalNetEur >= 0 ? "text-green-400" : "text-red-400"}
              />
              <StatsCard
                title="Operaciones"
                value={`${totalOperations} operaciones`}
                subValue={`${openCount} EUR→USD · ${realizedCount} USD→EUR`}
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
                      {exchangeMetrics.summary.investedEur.toFixed(2)} €
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-400 text-sm font-medium mb-2">📤 Recuperado</div>
                    <div className="text-2xl lg:text-3xl font-bold text-orange-400">
                      {exchangeMetrics.summary.recoveredEur.toFixed(2)} €
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Recuperación del capital</span>
                    <span>{exchangeMetrics.summary.recoveryRate.toFixed(2)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-blue-500 via-cyan-400 to-orange-400"
                      style={{ width: `${recoveryWidth}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Pendiente: {pendingEur.toFixed(2)} €</span>
                    <span>Posición abierta: {exchangeMetrics.summary.openCostEur.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <StatsCard
                title="Realizado acumulado"
                value={`${exchangeMetrics.summary.realizedNetEur >= 0 ? '+' : ''}${exchangeMetrics.summary.realizedNetEur.toFixed(2)} €`}
                subValue="Resultado cerrado por cierres USD→EUR"
                icon={<TrendingUpIcon className="w-5 h-5" />}
                color={exchangeMetrics.summary.realizedNetEur >= 0 ? "green" : "red"}
                valueClassName={exchangeMetrics.summary.realizedNetEur >= 0 ? "text-green-400" : "text-red-400"}
              />
              <StatsCard
                title="Posición abierta"
                value={`${exchangeMetrics.summary.openCurrentValueEur.toFixed(2)} €`}
                subValue={`Coste: ${exchangeMetrics.summary.openCostEur.toFixed(2)} €`}
                icon={<ChartIcon className="w-5 h-5" />}
                color="blue"
              />
              <StatsCard
                title="Progreso del ciclo"
                value={`${exchangeMetrics.summary.recoveryRate.toFixed(2)}%`}
                subValue="Capital ya vuelto a EUR frente a lo invertido"
                icon={<TrendingDownIcon className="w-5 h-5" />}
                color={exchangeMetrics.summary.recoveryRate >= 100 ? "green" : "orange"}
                valueClassName={exchangeMetrics.summary.recoveryRate >= 100 ? "text-green-400" : "text-orange-400"}
              />
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
        exchangeMetrics={exchangeMetrics}
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
