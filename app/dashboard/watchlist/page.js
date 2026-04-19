"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import WatchlistTable from "@/components/dashboard/WatchlistTable";
import AddWatchlistModal from "@/components/dashboard/AddWatchlistModal";
import { PlusIcon, RefreshIcon } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";

export default function PortfolioPage() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [existingAssets, setExistingAssets] = useState([]);

  useEffect(() => {
    if (user) {
      fetchWatchlist();
      fetchExistingAssets();
    }
  }, [user]);

  const fetchWatchlist = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      // Si no hay token, no hacemos la llamada y paramos aquí.
      if (!token) {
        console.log("Esperando token...");
        return;
      }
      const response = await fetch("/api/watchlist", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Error fetching watchlist");

      const data = await response.json();
      setWatchlist(data.watchlist || []);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingAssets = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return;
      const response = await fetch("/api/assets", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Error fetching assets");

      const data = await response.json();
      setExistingAssets(data.assets || []);
    } catch (error) {
      console.error("Error fetching assets:", error);
    }
  };

  const handleAddToWatchlist = async (item) => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        alert("Tu sesión ha expirado. Por favor, recarga la página.");
        return;
      }

      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item),
      });

      if (!response.ok) throw new Error("Error adding to watchlist");

      await fetchWatchlist();
    } catch (error) {
      console.error("Error adding to watchlist:", error);
    }
  };

  const handleDeleteFromWatchlist = async (id) => {
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar este activo de tu watchlist?"
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      const response = await fetch(`/api/watchlist/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Error deleting from watchlist");

      await fetchWatchlist();
    } catch (error) {
      console.error("Error deleting from watchlist:", error);
    }
  };

  const handleEditWatchlist = async (id, updates) => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return;
      
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Error updating watchlist");

      await fetchWatchlist();
    } catch (error) {
      console.error("Error updating watchlist:", error);
    }
  };

  const targetsReached = watchlist.filter((item) => item.targetReached).length;
  const totalTracking = watchlist.length;
  const successRate =
    totalTracking > 0 ? ((targetsReached / totalTracking) * 100).toFixed(1) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900/90 via-zinc-950 to-zinc-900/70 p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                Radar de oportunidades
              </p>
              <h2 className="mt-1 text-3xl font-semibold text-white">Watchlist</h2>
              <p className="mt-2 text-zinc-400 max-w-2xl">
              Sigue activos que te interesan y establece objetivos de precio
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <button
                onClick={fetchWatchlist}
                className="px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshIcon className="w-4 h-4" />
                Actualizar
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-linear-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30"
              >
                <PlusIcon className="w-4 h-4" />
                Añadir Asset
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        {watchlist.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-blue-500/20 blur-2xl" />
              <p className="text-sm text-zinc-400">Total Siguiendo</p>
              <p className="mt-2 text-3xl font-semibold text-white">{totalTracking}</p>
              <p className="mt-2 text-xs text-zinc-500">Activos monitorizados</p>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-emerald-500/20 blur-2xl" />
              <p className="text-sm text-zinc-400">Objetivos Alcanzados</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-400">{targetsReached}</p>
              <p className="mt-2 text-xs text-zinc-500">Señales confirmadas</p>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-cyan-500/20 blur-2xl" />
              <p className="text-sm text-zinc-400">Porcentaje Éxito</p>
              <p className="mt-2 text-3xl font-semibold text-cyan-400">{successRate}%</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-linear-to-r from-cyan-500 to-blue-500"
                  style={{ width: `${Math.min(Number(successRate), 100)}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
            Empieza creando tu primer activo en watchlist para ver métricas de seguimiento.
          </div>
        )}

        {/* Watchlist Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 px-5 py-4 bg-zinc-950/40">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Activos en seguimiento</h3>
              <p className="text-xs text-zinc-500">{totalTracking} activos listados</p>
            </div>
          </div>
          {isLoading ? (
            <div className="text-center py-12 text-zinc-400">
              Cargando watchlist...
            </div>
          ) : (
            <WatchlistTable
              watchlist={watchlist}
              onDelete={handleDeleteFromWatchlist}
              onEdit={handleEditWatchlist}
            />
          )}
        </div>
      </div>

      <AddWatchlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddToWatchlist}
        existingAssets={existingAssets}
      />
    </DashboardLayout>
  );
}
