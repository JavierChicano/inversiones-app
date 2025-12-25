'use client';

export default function PositionsTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Posiciones Detalladas</h3>
        <p className="text-zinc-400 text-center py-8">
          No hay posiciones abiertas en este momento
        </p>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Ordenar por % de ganancia (de mayor a menor)
  const sortedData = [...data].sort((a, b) => b.gainLossPercent - a.gainLossPercent);

  // Detectar si es crypto (asumiendo que viene en el objeto position.type)
  const getAssetColor = (position) => {
    // Si el tipo es CRYPTO, devolver color mostaza
    if (position.type === 'CRYPTO') {
      return 'bg-yellow-600'; // Color mostaza
    }
    return 'bg-blue-500'; // Color azul para stocks
  };
  
  const getAssetTypeLabel = (type) => {
    if (type === 'CRYPTO') return 'Crypto';
    if (type === 'FIAT') return 'Forex';
    return 'Stock';
  };
  
  // Calcular el porcentaje total
  const totalInvested = sortedData.reduce((sum, p) => sum + (p.quantity * p.avgBuyPrice), 0);
  const totalGainLoss = sortedData.reduce((sum, p) => sum + p.gainLoss, 0);
  const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Posiciones Detalladas</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">Ticker</th>
              <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">Tipo</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Cantidad</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Precio Medio</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Precio Actual</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Valor Actual</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Ganancia/Pérdida</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">%</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((position, index) => (
              <tr
                key={position.ticker}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getAssetColor(position)}`}></div>
                    <span className="text-white font-semibold">{position.ticker}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-left text-zinc-400 text-sm">
                  {getAssetTypeLabel(position.type)}
                </td>
                <td className="py-4 px-4 text-right text-zinc-300">
                  {position.quantity.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8,
                  })}
                </td>
                <td className="py-4 px-4 text-right text-zinc-300">
                  {formatCurrency(position.avgBuyPrice)}
                </td>
                <td className="py-4 px-4 text-right text-zinc-300">
                  {formatCurrency(position.currentPrice)}
                </td>
                <td className="py-4 px-4 text-right text-white font-semibold">
                  {formatCurrency(position.currentValue)}
                </td>
                <td className={`py-4 px-4 text-right font-semibold ${
                  position.gainLoss >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatCurrency(position.gainLoss)}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${
                    position.gainLossPercent >= 0
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {formatPercent(position.gainLossPercent)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-700 text-lg">
              <td className="py-4 px-4 text-white font-bold">Total</td>
              <td colSpan="4"></td>
              <td className="py-4 px-4 text-right text-white font-bold">
                {formatCurrency(sortedData.reduce((sum, p) => sum + p.currentValue, 0))}
              </td>
              <td className={`py-4 px-4 text-right font-bold ${
                totalGainLoss >= 0
                  ? 'text-green-500'
                  : 'text-red-500'
              }`}>
                {formatCurrency(totalGainLoss)}
              </td>
              <td className="py-4 px-4 text-right">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${
                  totalGainLossPercent >= 0
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  {formatPercent(totalGainLossPercent)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
