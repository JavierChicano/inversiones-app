"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRefresh } from "@/app/dashboard/layout";
import {
  GridIcon,
  ClipboardListIcon,
  BarChartIcon,
  SettingsIcon,
  RefreshIcon,
  ChevronRightIcon,
  WalletGrowthIcon,
  WatchlistIcon,
  CurrencyIcon,
  CoinStackIcon,
} from "../icons";

const REFRESH_COOLDOWN_SECONDS = 30;
const REFRESH_COOLDOWN_STORAGE_KEY = "dashboard-refresh-cooldown-until";

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const { handleRefresh: invalidateCache } = useRefresh();

  useEffect(() => {
    const syncCooldownState = () => {
      const storedCooldownUntil = Number(
        localStorage.getItem(REFRESH_COOLDOWN_STORAGE_KEY) || 0
      );

      if (!storedCooldownUntil) {
        setCooldownUntil(0);
        setCooldownRemaining(0);
        return;
      }

      const remainingSeconds = Math.max(
        0,
        Math.ceil((storedCooldownUntil - Date.now()) / 1000)
      );

      if (remainingSeconds === 0) {
        localStorage.removeItem(REFRESH_COOLDOWN_STORAGE_KEY);
        setCooldownUntil(0);
        setCooldownRemaining(0);
        return;
      }

      setCooldownUntil(storedCooldownUntil);
      setCooldownRemaining(remainingSeconds);
    };

    syncCooldownState();

    const intervalId = setInterval(syncCooldownState, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing || cooldownRemaining > 0) {
      return;
    }

    const cooldownEndsAt = Date.now() + REFRESH_COOLDOWN_SECONDS * 1000;
    localStorage.setItem(
      REFRESH_COOLDOWN_STORAGE_KEY,
      String(cooldownEndsAt)
    );
    setCooldownUntil(cooldownEndsAt);
    setCooldownRemaining(REFRESH_COOLDOWN_SECONDS);
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem("auth_token");

      // Actualizar assets del usuario
      const response = await fetch("/api/assets/refresh-user", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Assets actualizados:", result);

        // Invalidar caché del dashboard
        invalidateCache();

        // Recargar la página completamente para forzar nueva consulta
        window.location.reload();
      } else {
        console.error("Error al actualizar assets");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const sections = [
    {
      id: "overview",
      name: "Vista General",
      href: "/dashboard",
      icon: <GridIcon className="w-5 h-5" />,
    },
    {
      id: "transactions",
      name: "Transacciones",
      href: "/dashboard/transactions",
      icon: <ClipboardListIcon className="w-5 h-5" />,
    },
    {
      id: "divisas",
      name: "Divisas",
      href: "/dashboard/divisas",
      icon: <CurrencyIcon className="w-5 h-5" />,
    },
    {
      id: "staking",
      name: "Staking Hub",
      href: "/dashboard/staking",
      icon: <CoinStackIcon className="w-5 h-5" />,
    },
    {
      id: "analytics",
      name: "Análisis",
      href: "/dashboard/analytics",
      icon: <BarChartIcon className="w-5 h-5" />,
    },
    {
      id: "watchlist",
      name: "Watchlist",
      href: "/dashboard/watchlist",
      icon: <WatchlistIcon className="w-5 h-5" />,
    },
    {
      id: "settings",
      name: "Configuración",
      href: "/dashboard/settings",
      icon: <SettingsIcon className="w-5 h-5" />,
    },
  ];

  const getActiveSectionName = () => {
    const section = sections.find((s) => s.href === pathname);
    return section?.name || "Vista General";
  };

  const isRefreshDisabled = isRefreshing || cooldownRemaining > 0;

  return (
    <div className="mb-8">
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="flex items-center text-3xl gap-2 font-bold text-foreground mb-2">
            <WalletGrowthIcon className="h-12 w-12" /> Dashboard de Inversiones
          </h1>
          <p className="text-zinc-400">
            Gestiona y visualiza tu portfolio de inversiones
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshDisabled}
            className={`btn-secondary rounded-lg flex items-center gap-2 ${
              isRefreshDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
            title={
              cooldownRemaining > 0
                ? `Espera ${cooldownRemaining}s para volver a actualizar`
                : "Actualizar datos"
            }
          >
            <RefreshIcon
              className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">
              {isRefreshing
                ? "Actualizando..."
                : cooldownRemaining > 0
                  ? `Espera ${cooldownRemaining}s`
                  : "Actualizar"}
            </span>
          </button>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-2">
        <nav className="flex gap-2 overflow-x-auto">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              className={`flex h-11 w-40 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                pathname === section.href
                  ? "border-cyan-300/25 bg-cyan-300/15 text-cyan-100"
                  : "border-transparent text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {section.icon}
              <span>{section.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Breadcrumb */}
      <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-300 transition-colors">
          Inicio
        </Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-zinc-300">Dashboard</span>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-white font-medium">{getActiveSectionName()}</span>
      </div>
    </div>
  );
}
