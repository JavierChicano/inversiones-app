'use client';

import { TrendingUpIcon, CashIcon, ChartIcon } from '@/components/icons';
import { formatCurrency, formatSignedCurrency } from '@/lib/utils/formatters';
import Amount from '@/components/Amount';

const TONE = {
  green: 'bg-green-500/10 text-green-500 border-green-500/20',
  red: 'bg-red-500/10 text-red-500 border-red-500/20',
};

function SummaryTile({ title, value, hint, icon }) {
  const tone = value >= 0 ? 'green' : 'red';

  return (
    <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors">
      <div className={`shrink-0 p-2 rounded-lg border ${TONE[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-zinc-500">{title}</div>
        <div className={`text-lg font-bold leading-tight ${value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          <Amount>{formatSignedCurrency(value)}</Amount>
        </div>
        <div className="text-xs text-zinc-500 truncate"><Amount>{hint}</Amount></div>
      </div>
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 animate-pulse">
      <div className="h-10 w-10 bg-zinc-800 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-28 bg-zinc-800 rounded" />
        <div className="h-5 w-32 bg-zinc-800 rounded" />
        <div className="h-3 w-40 bg-zinc-800 rounded" />
      </div>
    </div>
  );
}

/**
 * Resumen general del perfil: resultado neto total, P&L realizado y P&L latente.
 * Recibe el objeto `stats` de /api/dashboard/stats.
 */
export default function ProfileSummary({ stats, loading, error }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SkeletonTile />
        <SkeletonTile />
        <SkeletonTile />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="text-zinc-500 text-sm">
        Todavía no hay datos suficientes. Añade transacciones para ver tu resumen.
      </p>
    );
  }

  const realizedEur = stats.netTotal?.eur ?? 0;
  const realizedUsd = stats.netTotal?.usd ?? 0;
  const latentEur = (stats.portfolioTotal?.eur ?? 0) - (stats.invested?.eur ?? 0);
  const latentUsd = (stats.portfolioTotal?.usd ?? 0) - (stats.invested?.usd ?? 0);
  const totalEur = realizedEur + latentEur;
  const totalUsd = realizedUsd + latentUsd;
  const investedUsd = stats.invested?.usd ?? 0;
  const latentPercent = investedUsd > 0 ? (latentUsd / investedUsd) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <SummaryTile
        title="Resultado neto total"
        value={totalEur}
        hint={`${formatSignedCurrency(totalUsd, 'USD')} · realizado + latente`}
        icon={<TrendingUpIcon className="w-5 h-5" />}
      />
      <SummaryTile
        title="P&L realizado"
        value={realizedEur}
        hint={`${formatSignedCurrency(realizedUsd, 'USD')} · ${stats.closedPositions || 0} ventas`}
        icon={<CashIcon className="w-5 h-5" />}
      />
      <SummaryTile
        title="P&L latente"
        value={latentEur}
        hint={`${latentPercent >= 0 ? '+' : ''}${latentPercent.toFixed(2)}% sobre ${formatCurrency(stats.invested?.eur ?? 0)} invertidos`}
        icon={<ChartIcon className="w-5 h-5" />}
      />
    </div>
  );
}
