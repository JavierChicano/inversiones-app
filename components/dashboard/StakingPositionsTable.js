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

function getElapsedDaysSince(startDate) {
  if (!startDate) return 0;

  const parsedDate = new Date(startDate);
  if (Number.isNaN(parsedDate.getTime())) return 0;

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((Date.now() - parsedDate.getTime()) / msPerDay));
}

export default function StakingPositionsTable({ positions = [], onUnstake }) {
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center">
        <h3 className="text-lg font-semibold text-white">No tienes staking activo</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Crea tu primera posición para ver ganancia proyectada y ganancia real acumulada.
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
            <th className="px-4 py-3 text-right">Ganancia proyectada</th>
            <th className="px-4 py-3 text-right">Ganancia real acumulada</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const elapsedDays = getElapsedDaysSince(position.startDate);
            const nonEarningDays = 3;
            const earningDays = Math.max(0, elapsedDays - nonEarningDays);
            const realAccumulatedCoin = (position.projection?.daily?.coin || 0) * earningDays;
            const realAccumulatedUsd = (position.projection?.daily?.usd || 0) * earningDays;

            return (
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
                <div className="space-y-1">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">Día</span>
                    <span className="font-medium text-zinc-200">
                      {formatCoin(position.projection?.daily?.coin, position.assetTicker)}
                    </span>
                    <span className="inline-flex w-12 justify-end text-xs text-zinc-500">
                      {formatUsd(position.projection?.daily?.usd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">Mes</span>
                    <span className="font-medium text-zinc-200">
                      {formatCoin(position.projection?.monthly?.coin, position.assetTicker)}
                    </span>
                    <span className="inline-flex w-12 justify-end text-xs text-zinc-500">
                      {formatUsd(position.projection?.monthly?.usd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">Año</span>
                    <span className="font-medium text-zinc-200">
                      {formatCoin(position.projection?.annual?.coin, position.assetTicker)}
                    </span>
                    <span className="inline-flex w-12 justify-end text-xs text-zinc-500">
                      {formatUsd(position.projection?.annual?.usd)}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="font-semibold text-emerald-300">
                  {formatCoin(realAccumulatedCoin, position.assetTicker)}
                </div>
                <div className="text-xs text-emerald-400/80">{formatUsd(realAccumulatedUsd)}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {earningDays} días generando (3 de lock)
                </div>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
