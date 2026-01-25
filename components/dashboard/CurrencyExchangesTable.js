"use client";
import { useState, useEffect, useRef } from "react";

export default function CurrencyExchangesTable({ exchanges, onDelete, onEdit }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const formatCurrency = (value, currency) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency,
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
        <p className="text-zinc-400 text-center py-8">
          No hay cambios de divisa registrados
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Cambios de Divisa</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">
                Fecha
              </th>
              <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">
                Cambio
              </th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">
                Cantidad
              </th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">
                Tipo Original
              </th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">
                Tipo Actual
              </th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">
                Valor Actual
              </th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">
                Ganancia/Pérdida
              </th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Calcular totales para la fila de resumen
              const totalAmount = exchanges.reduce((sum, ex) => sum + (ex.fromCurrency === 'EUR' ? ex.amount : 0), 0);
              const totalDifference = exchanges.reduce((sum, ex) => sum + ex.difference, 0);
              const weightedRateSum = exchanges.reduce((sum, ex) => {
                return sum + (ex.fromCurrency === 'EUR' ? ex.exchangeRate * ex.amount : 0);
              }, 0);
              const avgRate = totalAmount > 0 ? weightedRateSum / totalAmount : 0;
              const totalCurrentValue = exchanges.reduce((sum, ex) => {
                if (ex.fromCurrency === 'EUR') {
                  return sum + (ex.originalValue / ex.currentRate);
                }
                return sum;
              }, 0);
              // Obtener el tipo actual (será el mismo para todas)
              const currentRate = exchanges.length > 0 ? exchanges[0].currentRate : 0;

              return (
                <>
                  {/* Fila de totales */}
                  <tr className="bg-zinc-800/50 border-b-2 border-zinc-700 font-semibold">
                    <td className="py-4 px-4 text-white text-sm">
                      TOTAL
                    </td>
                    <td className="py-4 px-4 text-left text-zinc-400 text-sm">
                      —
                    </td>
                    <td className="py-4 px-4 text-center text-white font-bold text-sm">
                      {formatCurrency(totalAmount, 'EUR')}
                    </td>
                    <td className="py-4 px-4 text-center text-yellow-500 font-bold text-sm">
                      {avgRate > 0 ? avgRate.toFixed(4) : '—'}
                    </td>
                    <td className="py-4 px-4 text-center text-purple-400 font-bold text-sm">
                      {currentRate > 0 ? currentRate.toFixed(4) : '—'}
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-white text-sm">
                      {formatCurrency(totalCurrentValue, 'EUR')}
                    </td>
                    <td className="py-4 px-4 text-right text-sm">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-lg font-bold ${
                            totalDifference >= 0
                              ? "text-blue-400"
                              : "text-orange-400"
                          }`}
                        >
                          {totalAmount > 0 ? formatPercentage((totalDifference / totalAmount) * 100) : '—'}
                        </span>
                        <span
                          className={`text-xs ${
                            totalDifference >= 0
                              ? "text-blue-300"
                              : "text-orange-300"
                          }`}
                        >
                          {formatCurrency(Math.abs(totalDifference), 'EUR')}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-zinc-400 text-sm">
                      —
                    </td>
                  </tr>
                  {/* Filas individuales */}
                  {
            exchanges.map((exchange) => {
              const isProfit = exchange.difference > 0;
              const isNearBreakeven = Math.abs(exchange.percentage) < 1;
              const isGoodTarget = exchange.fromCurrency === 'EUR' 
                ? exchange.currentRate <= exchange.breakEvenRate // EUR→USD: mejor si baja
                : exchange.currentRate >= exchange.goodTargetRate; // USD→EUR: mejor si sube
              
              // Calcular el valor actual en la moneda original (para mostrar)
              const currentValueInOriginalCurrency = exchange.fromCurrency === 'EUR'
                ? exchange.originalValue / exchange.currentRate // USD → EUR
                : exchange.originalValue * exchange.currentRate; // EUR → USD

              return (
                <tr
                  key={exchange.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="py-4 px-4 text-white text-sm">
                    {formatDate(exchange.date)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {exchange.fromCurrency}
                      </span>
                      <span className="text-zinc-500">→</span>
                      <span className="font-semibold text-white">
                        {exchange.toCurrency}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center text-white font-medium text-sm">
                    {formatCurrency(exchange.amount, exchange.fromCurrency)}
                  </td>
                  <td className="py-4 px-4 text-center text-yellow-500 font-semibold text-sm">
                    {exchange.exchangeRate.toFixed(4)}
                  </td>
                  <td className="py-4 px-4 text-center text-sm">
                    <span className={isGoodTarget ? 'text-green-500 font-medium' : 'text-zinc-300'}>
                      {exchange.currentRate.toFixed(4)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-white text-sm">
                    {formatCurrency(currentValueInOriginalCurrency, exchange.fromCurrency)}
                  </td>
                  <td className="py-4 px-4 text-right text-sm">
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-lg font-bold ${
                          isProfit
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {formatPercentage(exchange.percentage)}
                      </span>
                      <span
                        className={`text-xs ${
                          isProfit
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {formatCurrency(Math.abs(exchange.difference), exchange.fromCurrency)}
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
            })
          }
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
