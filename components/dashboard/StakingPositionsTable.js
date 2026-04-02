'use client';

function formatCoin(value, ticker) {
  return `${(Number(value) || 0).toFixed(4)} ${ticker}`;
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function StakingPositionsTable({ positions = [], onUnstake }) {
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center">
        <h3 className="text-lg font-semibold text-white">No tienes staking activo</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Crea tu primera posición para ver proyecciones de ganancia diaria, mensual y anual.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-400">
            <th className="px-4 py-3 text-left">Asset</th>
            <th className="px-4 py-3 text-right">Cantidad staked</th>
            <th className="px-4 py-3 text-right">APY</th>
            <th className="px-4 py-3 text-right">Lock</th>
            <th className="px-4 py-3 text-right">Ganancia diaria</th>
            <th className="px-4 py-3 text-right">Ganancia mensual</th>
            <th className="px-4 py-3 text-right">Ganancia anual</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.id} className="border-b border-zinc-800/60 text-zinc-200 last:border-b-0">
              <td className="px-4 py-4">
                <div className="font-semibold text-white">{position.assetTicker}</div>
                <div className="text-xs text-zinc-500">{position.assetName || '-'}</div>
              </td>
              <td className="px-4 py-4 text-right font-medium text-cyan-200">
                {formatCoin(position.amountStaked, position.assetTicker)}
              </td>
              <td className="px-4 py-4 text-right text-emerald-300">{Number(position.manualApy || 0).toFixed(2)}%</td>
              <td className="px-4 py-4 text-right text-zinc-300">{position.lockPeriodDays || 0} días</td>
              <td className="px-4 py-4 text-right">
                <div className="font-medium text-zinc-200">
                  {formatCoin(position.projection?.daily?.coin, position.assetTicker)}
                </div>
                <div className="text-xs text-zinc-500">{formatUsd(position.projection?.daily?.usd)}</div>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="font-medium text-zinc-200">
                  {formatCoin(position.projection?.monthly?.coin, position.assetTicker)}
                </div>
                <div className="text-xs text-zinc-500">{formatUsd(position.projection?.monthly?.usd)}</div>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="font-medium text-zinc-200">
                  {formatCoin(position.projection?.annual?.coin, position.assetTicker)}
                </div>
                <div className="text-xs text-zinc-500">{formatUsd(position.projection?.annual?.usd)}</div>
              </td>
              <td className="px-4 py-4 text-right">
                <button
                  type="button"
                  onClick={() => onUnstake?.(position)}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                  Retirar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
