'use client';

import Amount from '../Amount';
import { formatDateTime, formatDuration, formatPrice, formatSignedPercent, formatUsd } from '@/lib/utils/formatters';
import { CLOSE_REASON_LABELS, DIRECTION_LABELS } from '@/lib/utils/leverage';

function directionBadgeClass(direction) {
  return direction === 'SHORT' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300';
}

function reasonBadgeClass(reason) {
  if (reason === 'LIQUIDATION') return 'bg-rose-500/15 text-rose-300';
  if (reason === 'STOP_LOSS') return 'bg-amber-500/15 text-amber-300';
  if (reason === 'TAKE_PROFIT') return 'bg-emerald-500/15 text-emerald-300';
  return 'bg-cyan-500/15 text-cyan-300';
}

function pnlClass(value) {
  return value >= 0 ? 'text-emerald-300' : 'text-rose-300';
}

export default function LeveragedHistoryTable({ positions = [], onDelete }) {
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center">
        <h3 className="text-lg font-semibold text-white">Sin cierres todavía</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Cuando cierres una posición verás aquí el P&amp;L bruto y neto, las comisiones totales y el motivo de cierre.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-400">
            <th className="px-4 py-3 text-left">Cierre</th>
            <th className="px-4 py-3 text-left">Activo</th>
            <th className="px-4 py-3 text-right">Garantía</th>
            <th className="px-4 py-3 text-right">Entrada → cierre</th>
            <th className="px-4 py-3 text-right">Tiempo</th>
            <th className="px-4 py-3 text-right">Comisiones</th>
            <th className="px-4 py-3 text-right">P&amp;L bruto</th>
            <th className="px-4 py-3 text-right">P&amp;L neto</th>
            <th className="px-4 py-3 text-left">Motivo</th>
            <th className="px-4 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.id} className="border-b border-zinc-800/60 text-zinc-200 last:border-b-0">
              <td className="px-4 py-4 align-top text-xs text-zinc-400">
                <div>{formatDateTime(position.closedAt)}</div>
                <div className="text-[11px] text-zinc-500">Abierta {formatDateTime(position.openedAt)}</div>
              </td>
              <td className="px-4 py-4 align-top">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{position.assetTicker}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${directionBadgeClass(position.direction)}`}>
                    {DIRECTION_LABELS[position.direction] || position.direction} x{position.leverage}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">{position.assetName || position.assetTicker}</div>
              </td>
              <td className="px-4 py-4 text-right align-top">
                <div className="text-white">
                  <Amount>{formatUsd(position.margin)}</Amount>
                </div>
                <div className="text-xs text-zinc-500">
                  Exp. <Amount>{formatUsd(position.exposure)}</Amount>
                </div>
              </td>
              <td className="px-4 py-4 text-right align-top text-xs text-zinc-300">
                <div>{formatPrice(position.entryPrice)}</div>
                <div className="text-white">{formatPrice(position.closePrice)}</div>
              </td>
              <td className="px-4 py-4 text-right align-top">
                <div className="text-zinc-300">{formatDuration(position.openedAt, position.closedAt)}</div>
                <div className="text-[11px] text-zinc-500">
                  {position.daysHeld || 0} {position.daysHeld === 1 ? 'noche' : 'noches'} de swap
                </div>
              </td>
              <td className="px-4 py-4 text-right align-top">
                <div className="text-amber-300">
                  <Amount>{formatUsd(position.totalFees)}</Amount>
                </div>
                <div className="text-[11px] text-zinc-500">
                  swap <Amount>{formatUsd(position.swapTotal)}</Amount>
                </div>
              </td>
              <td className={`px-4 py-4 text-right align-top ${pnlClass(position.grossPnl)}`}>
                <Amount>{formatUsd(position.grossPnl)}</Amount>
              </td>
              <td className="px-4 py-4 text-right align-top">
                <div className={`font-semibold ${pnlClass(position.netPnl)}`}>
                  <Amount>{formatUsd(position.netPnl)}</Amount>
                </div>
                <div className={`text-xs ${pnlClass(position.roi)}`}>ROI {formatSignedPercent(position.roi)}</div>
              </td>
              <td className="px-4 py-4 align-top">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reasonBadgeClass(position.closeReason)}`}>
                  {CLOSE_REASON_LABELS[position.closeReason] || position.closeReason}
                </span>
                {position.notes && <div className="mt-1 max-w-48 truncate text-[11px] text-zinc-500" title={position.notes}>{position.notes}</div>}
              </td>
              <td className="px-4 py-4 text-right align-top">
                <button type="button" onClick={() => onDelete?.(position)} className="text-[11px] text-zinc-500 transition-colors hover:text-rose-300">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
