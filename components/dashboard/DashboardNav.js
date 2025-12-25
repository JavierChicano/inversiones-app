"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useRefresh } from "@/app/dashboard/layout";
import {
  GridIcon,
  ClipboardListIcon,
  BarChartIcon,
  BriefcaseIcon,
  SettingsIcon,
  RefreshIcon,
  ChevronRightIcon,
  WalletGrowthIcon,
} from "../icons";

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { handleRefresh: invalidateCache } = useRefresh();

  const handleRefresh = async () => {
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
      id: "analytics",
      name: "Análisis",
      href: "/dashboard/analytics",
      icon: <BarChartIcon className="w-5 h-5" />,
    },
    {
      id: "portfolio",
      name: "Portfolio",
      href: "/dashboard/portfolio",
      icon: <BriefcaseIcon className="w-5 h-5" />,
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
            disabled={isRefreshing}
            className={`px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors flex items-center gap-2 ${
              isRefreshing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
            title="Actualizar datos"
          >
            <RefreshIcon
              className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">
              {isRefreshing ? "Actualizando..." : "Actualizar"}
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                pathname === section.href
                  ? "bg-primary text-white shadow-lg"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
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
