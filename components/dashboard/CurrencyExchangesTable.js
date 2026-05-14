"use client";
import { useState, useEffect, useRef } from "react";
import { calculateCurrencyExchangeMetrics } from "@/lib/utils/currencyExchangeMetrics";

export default function CurrencyExchangesTable({ exchanges, exchangeMetrics, onDelete, onEdit }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const fallbackCurrentRate = exchanges.find((exchange) => exchange.currentRate)?.currentRate || 0;
  const computedMetrics = exchangeMetrics || calculateCurrencyExchangeMetrics(exchanges, fallbackCurrentRate);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const formatCurrency = (value, currency) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatPercentage = (value) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  if (exchanges.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Cambios de Divisa</h3>
        <p className="text-zinc-400 text-center py-8">No hay cambios de divisa</p>
      </div>
    );
  }

  const eurToUsdExchanges = exchanges.filter((ex) => ex.fromCurrency === "EUR");

  // Totales de abiertas (solo EUR->USD)
  const totalAmount = eurToUsdExchanges.reduce((sum, ex) => sum + ex.amount, 0);
  const totalDifference = eurToUsdExchanges.reduce((sum, ex) => sum + ex.difference, 0);
  const weightedRateSum = eurToUsdExchanges.reduce((sum, ex) => {
    return sum + ex.exchangeRate * ex.amount;
  }, 0);
  const avgRate = totalAmount > 0 ? weightedRateSum / totalAmount : 0;
  const totalCurrentValue = eurToUsdExchanges.reduce((sum, ex) => {
    return sum + ex.originalValue / ex.currentRate;
  }, 0);
  const currentRate = eurToUsdExchanges.length > 0 ? eurToUsdExchanges[0].currentRate : 0;
  const openRowDifference = computedMetrics.summary.openUnrealizedEur;
  const openRowValue = computedMetrics.summary.openCurrentValueEur;

  // Total global (EUR->USD + USD->EUR) normalizado a base EUR
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Cambios de Divisa</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">Fecha</th>
              <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">Cambio</th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Cantidad</th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Tipo Original</th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Tipo Actual</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Valor Actual</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Ganancia/Perdida</th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eurToUsdExchanges.length > 0 && (
              <tr className="bg-zinc-800/50 border-b-2 border-zinc-700 font-semibold">
                <td className="py-4 px-4 text-white text-sm">TOTAL ABIERTAS</td>
                <td className="py-4 px-4 text-left text-zinc-400 text-sm">-</td>
                <td className="py-4 px-4 text-center text-white font-bold text-sm">
                  {formatCurrency(computedMetrics.summary.openCostEur || totalAmount, "EUR")}
                </td>
                <td className="py-4 px-4 text-center text-yellow-500 font-bold text-sm">
                  {avgRate > 0 ? avgRate.toFixed(4) : "-"}
                </td>
                <td className="py-4 px-4 text-center text-purple-400 font-bold text-sm">
                  {currentRate > 0 ? currentRate.toFixed(4) : "-"}
                </td>
                <td className="py-4 px-4 text-right font-bold text-white text-sm">
                  {formatCurrency(openRowValue || totalCurrentValue, "EUR")}
                </td>
                <td className="py-4 px-4 text-right text-sm">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-lg font-bold ${(openRowDifference || totalDifference) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {computedMetrics.summary.openCostEur > 0
                        ? formatPercentage((openRowDifference || totalDifference) / computedMetrics.summary.openCostEur * 100)
                        : totalAmount > 0
                          ? formatPercentage((totalDifference / totalAmount) * 100)
                          : "-"}
                    </span>
                    <span className={`text-xs ${(openRowDifference || totalDifference) >= 0 ? "text-green-300" : "text-red-300"}`}>
                      {formatCurrency(Math.abs(openRowDifference || totalDifference), "EUR")}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-center text-zinc-400 text-sm">-</td>
              </tr>
            )}

            {exchanges.map((exchange) => {
              const rowMetrics = computedMetrics.byId.get(exchange.id);
              const isRealized = rowMetrics?.mode === "closed" || exchange.fromCurrency === "USD";
              const isProfit = (rowMetrics?.differenceEur ?? exchange.difference) > 0;
              const currentValueDisplay = rowMetrics?.currentValueEur ?? (isRealized
                ? exchange.amount * exchange.exchangeRate
                : exchange.originalValue / exchange.currentRate);
              const differenceDisplay = rowMetrics?.differenceEur ?? exchange.difference;
              const percentageDisplay = rowMetrics?.percentage ?? exchange.percentage;

              return (
                <tr
                  key={exchange.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                    isRealized ? "opacity-75" : ""
                  }`}
                >
                  <td className="py-4 px-4 text-white text-sm">{formatDate(exchange.date)}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isRealized ? "text-orange-400" : "text-white"}`}>
                          {exchange.fromCurrency}
                        </span>
                        <span className="text-zinc-500">→</span>
                        <span className={`font-semibold ${isRealized ? "text-orange-400" : "text-white"}`}>
                          {exchange.toCurrency}
                        </span>
                      </div>
                      {isRealized && (
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-semibold rounded border border-orange-500/50">
                          REALIZADA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center text-white font-medium text-sm">
                    {formatCurrency(exchange.amount, exchange.fromCurrency)}
                  </td>
                  <td className="py-4 px-4 text-center text-yellow-500 font-semibold text-sm">
                    {exchange.exchangeRate.toFixed(4)}
                  </td>
                  <td className="py-4 px-4 text-center text-purple-300 font-medium text-sm">
                    {isRealized ? "-" : exchange.currentRate.toFixed(4)}
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-white text-sm">
                    {formatCurrency(currentValueDisplay, "EUR")}
                  </td>
                  <td className="py-4 px-4 text-right text-sm">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-lg font-bold ${isProfit ? "text-green-400" : "text-red-400"}`}>
                        {formatPercentage(percentageDisplay)}
                      </span>
                      <span className={`text-xs ${isProfit ? "text-green-300" : "text-red-300"}`}>
                        {formatCurrency(Math.abs(differenceDisplay), "EUR")}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center relative">
                    <div ref={openMenuId === exchange.id ? menuRef : null}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === exchange.id ? null : exchange.id)}
                        className="text-zinc-400 hover:text-white transition-colors p-1"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {openMenuId === exchange.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => {
                              onEdit(exchange);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-700 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onDelete(exchange.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Borrar
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

          </tbody>
        </table>
      </div>
    </div>
  );
}
