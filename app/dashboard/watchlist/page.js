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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Watchlist</h2>
            <p className="text-zinc-400">
              Sigue activos que te interesan y establece objetivos de precio
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Añadir Asset
            </button>
          </div>
        </div>

        {/* Stats */}
        {watchlist.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-400 mb-1">Total Siguiendo</p>
              <p className="text-2xl font-bold text-white">{totalTracking}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-400 mb-1">Objetivos Alcanzados</p>
              <p className="text-2xl font-bold text-green-500">
                {targetsReached}
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-400 mb-1">Porcentaje Éxito</p>
              <p className="text-2xl font-bold text-blue-500">
                {totalTracking > 0
                  ? ((targetsReached / totalTracking) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
          </div>
        )}

        {/* Watchlist Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
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
