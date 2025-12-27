'use client';

import { formatHoldingTime } from '@/lib/utils/formatters';

export default function ClosedPositionsTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Posiciones Cerradas por Ticker</h3>
        <p className="text-zinc-400 text-center py-8">No hay posiciones cerradas aún</p>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getAssetTypeLabel = (type) => {
    if (type === 'CRYPTO') return 'Crypto';
    if (type === 'FIAT') return 'Forex';
    return 'Stock';
  };

  const getAssetColor = (type) => {
    if (type === 'CRYPTO') return 'bg-yellow-600';
    return 'bg-blue-500';
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Posiciones Cerradas por Ticker</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">Ticker</th>
              <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">Tipo</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Operaciones</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Ganancia Total</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Ganancia Media</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">ROI</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Tiempo Posesión</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Win Rate</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">W/L</th>
            </tr>
          </thead>
          <tbody>
            {data.map((position, index) => (
              <tr
                key={position.ticker}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getAssetColor(position.type)}`} />
                    <span className="text-white font-semibold">{position.ticker}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-zinc-400 text-sm">
                  {getAssetTypeLabel(position.type)}
                </td>
                <td className="py-4 px-4 text-right text-white">
                  {position.totalTrades}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className={`font-semibold ${
                    position.totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {formatCurrency(position.totalGainLoss)}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className={`${
                    position.avgGainPerTrade >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {formatCurrency(position.avgGainPerTrade)}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${
                    position.roi >= 0
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {formatPercent(position.roi)}
                  </span>
                </td>
                <td className="py-4 px-4 text-right text-zinc-300">
                  {formatHoldingTime(position.avgHoldingDays || 0)}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${
                    position.winRate >= 50
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {formatPercent(position.winRate)}
                  </span>
                </td>
                <td className="py-4 px-4 text-right text-zinc-400 text-sm">
                  <span className="text-green-500">{position.winningTrades}</span>
                  /
                  <span className="text-red-500">{position.losingTrades}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
