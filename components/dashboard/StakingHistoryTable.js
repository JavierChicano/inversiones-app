'use client';

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatCoin(value, ticker) {
  return `${(Number(value) || 0).toFixed(6)} ${ticker}`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function StakingHistoryTable({ history = [] }) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center">
        <h3 className="text-lg font-semibold text-white">Sin historial todavía</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Cuando abras o cierres staking aquí verás cada evento con su APY real y la recompensa generada.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-400">
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-left">Evento</th>
            <th className="px-4 py-3 text-left">Asset</th>
            <th className="px-4 py-3 text-right">Principal</th>
            <th className="px-4 py-3 text-right">Recompensa</th>
            <th className="px-4 py-3 text-right">APY real</th>
            <th className="px-4 py-3 text-right">Días</th>
          </tr>
        </thead>
        <tbody>
          {history.map((event) => (
            <tr key={event.id} className="border-b border-zinc-800/60 text-zinc-200 last:border-b-0">
              <td className="px-4 py-4 text-zinc-400">{formatDate(event.createdAt)}</td>
              <td className="px-4 py-4">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  event.eventType === 'UNSTAKE'
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-cyan-500/15 text-cyan-300'
                }`}>
                  {event.eventType === 'UNSTAKE' ? 'Retirada' : 'Alta'}
                </span>
                {event.eventType === 'UNSTAKE' && (
                  <div className="mt-1 text-xs text-zinc-500">Principal liberado + recompensa a coste 0</div>
                )}
              </td>
              <td className="px-4 py-4 font-semibold text-white">{event.assetTicker}</td>
              <td className="px-4 py-4 text-right text-zinc-300">
                {formatCoin(event.principalAmount, event.assetTicker)}
              </td>
              <td className="px-4 py-4 text-right text-emerald-300">
                {formatCoin(event.rewardAmount, event.assetTicker)}
                <div className="text-xs text-zinc-500">{formatUsd((event.rewardAmount || 0) * (event.currentPrice || 0))}</div>
              </td>
              <td className="px-4 py-4 text-right text-zinc-300">
                {Number(event.realizedApy || 0).toFixed(2)}%
              </td>
              <td className="px-4 py-4 text-right text-zinc-400">{event.stakedDays || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
