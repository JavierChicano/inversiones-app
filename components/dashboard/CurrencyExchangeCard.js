'use client';

export default function CurrencyExchangeCard({ rate, portfolioUSD, portfolioEUR }) {
  const formatCurrency = (value, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Tipo de Cambio</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <span className="text-blue-500 font-bold text-lg">€</span>
            </div>
            <div>
              <p className="text-zinc-400 text-sm">EUR/USD</p>
              <p className="text-white text-xl font-bold">{rate.toFixed(4)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-zinc-400 text-sm">1 EUR =</p>
            <p className="text-green-500 text-lg font-semibold">{rate.toFixed(4)} USD</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
            <p className="text-zinc-400 text-xs mb-1">Portfolio EUR</p>
            <p className="text-white text-lg font-bold">{formatCurrency(portfolioEUR)}</p>
          </div>
          <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
            <p className="text-zinc-400 text-xs mb-1">Portfolio USD</p>
            <p className="text-white text-lg font-bold">{formatCurrency(portfolioUSD, 'USD')}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <p className="text-zinc-500 text-xs text-center">
            Última actualización: {new Date().toLocaleString('es-ES')}
          </p>
        </div>
      </div>
    </div>
  );
}
