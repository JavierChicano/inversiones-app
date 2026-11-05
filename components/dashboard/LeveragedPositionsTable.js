'use client';

import Amount from '../Amount';
import { formatCoin, formatDateTime, formatPercent, formatPrice, formatSignedPercent, formatUsd } from '@/lib/utils/formatters';
import { DIRECTION_LABELS, LEVERAGED_ASSET_TYPE_LABELS } from '@/lib/utils/leverage';

function directionBadgeClass(direction) {
  return direction === 'SHORT' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300';
}

function pnlClass(value) {
  return value >= 0 ? 'text-emerald-300' : 'text-rose-300';
}

function riskClasses(proximity) {
  if (proximity >= 75) return { bar: 'bg-rose-500', text: 'text-rose-300', label: 'Peligro' };
  if (proximity >= 50) return { bar: 'bg-amber-500', text: 'text-amber-300', label: 'Atención' };
  if (proximity >= 25) return { bar: 'bg-yellow-400', text: 'text-yellow-300', label: 'Vigilar' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-300', label: 'Seguro' };
}

/** Barra de proximidad al precio de liquidación (0 % = en entrada o beneficio, 100 % = liquidada). */
export function LiquidationRiskBar({ proximity, liquidationPrice, distancePercent }) {
  if (proximity === null || proximity === undefined) {
    return (
      <div className="text-xs text-zinc-500">
        Liq. <span className="text-amber-300">{formatPrice(liquidationPrice)}</span> · sin precio actual
      </div>
    );
  }

  const { bar, text, label } = riskClasses(proximity);

  return (
    <div className="min-w-40 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          Liq. <span className="text-amber-300">{formatPrice(liquidationPrice)}</span>
        </span>
        <span className={`font-semibold ${text}`}>
          {label} · {formatPercent(proximity, 0)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={Math.round(proximity)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.max(2, proximity)}%` }} />
      </div>
      {distancePercent !== null && distancePercent !== undefined && (
        <p className="text-[11px] text-zinc-500">El precio está a {formatPercent(distancePercent, 1)} de la liquidación</p>
      )}
    </div>
  );
}

export default function LeveragedPositionsTable({ positions = [], onClose, onEdit, onDelete }) {
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center">
        <h3 className="text-lg font-semibold text-white">No tienes posiciones apalancadas abiertas</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Abre tu primera posición en largo o en corto para seguir el P&amp;L neto, el swap acumulado y la distancia al precio de liquidación.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-400">
            <th className="px-4 py-3 text-left">Activo</th>
            <th className="px-4 py-3 text-right">Garantía</th>
            <th className="px-4 py-3 text-right">Entrada / actual</th>
            <th className="px-4 py-3 text-right">Cantidad</th>
            <th className="px-4 py-3 text-left">Riesgo de liquidación</th>
            <th className="px-4 py-3 text-right">P&amp;L latente</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const evaluation = position.evaluation || {};
            const netPnl = Number(evaluation.netPnl || 0);

            return (
              <tr key={position.id} className="border-b border-zinc-800/60 text-zinc-200 last:border-b-0">
                <td className="px-4 py-4 align-top">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{position.assetTicker}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${directionBadgeClass(position.direction)}`}>
                      {DIRECTION_LABELS[position.direction] || position.direction} x{position.leverage}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {position.assetName || position.assetTicker} · {LEVERAGED_ASSET_TYPE_LABELS[position.assetType] || position.assetType}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Abierta {formatDateTime(position.openedAt)} · {evaluation.daysHeld || 0} {evaluation.daysHeld === 1 ? 'noche' : 'noches'}
                  </div>
                  {position.notes && <div className="mt-1 max-w-56 truncate text-[11px] text-zinc-400" title={position.notes}>{position.notes}</div>}
                </td>
                <td className="px-4 py-4 text-right align-top">
                  <div className="font-medium text-white">
                    <Amount>{formatUsd(position.margin)}</Amount>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Exposición <Amount>{formatUsd(position.exposure)}</Amount>
                  </div>
                </td>
                <td className="px-4 py-4 text-right align-top">
                  <div className="text-zinc-300">{formatPrice(position.entryPrice)}</div>
                  {evaluation.hasPrice ? (
                    <div className="text-xs">
                      <span className="text-white">{formatPrice(evaluation.currentPrice)}</span>{' '}
                      <span className={pnlClass(evaluation.priceChangePercent)}>({formatSignedPercent(evaluation.priceChangePercent)})</span>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">Sin precio actual</div>
                  )}
                </td>
                <td className="px-4 py-4 text-right align-top text-zinc-300">
                  <Amount>{formatCoin(position.quantity, { maximumFractionDigits: 6 })}</Amount>
                </td>
                <td className="px-4 py-4 align-top">
                  <LiquidationRiskBar
                    proximity={evaluation.liquidationProximity}
                    liquidationPrice={position.liquidationPrice}
                    distancePercent={evaluation.distanceToLiquidationPercent}
                  />
                </td>
                <td className="px-4 py-4 text-right align-top">
                  <div className={`font-semibold ${pnlClass(netPnl)}`}>
                    <Amount>{formatUsd(netPnl)}</Amount>
                  </div>
                  <div className={`text-xs ${pnlClass(evaluation.roi || 0)}`}>ROI {formatSignedPercent(evaluation.roi || 0)}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Bruto <Amount>{formatUsd(evaluation.grossPnl || 0)}</Amount> · comisiones <Amount>{formatUsd(evaluation.feesAccrued || 0)}</Amount>
                  </div>
                </td>
                <td className="px-4 py-4 text-right align-top">
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onClose?.(position)}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                    >
                      Cerrar
                    </button>
                    <div className="flex gap-2 text-[11px]">
                      <button type="button" onClick={() => onEdit?.(position)} className="text-cyan-300 transition-colors hover:text-cyan-200">
                        Editar
                      </button>
                      <button type="button" onClick={() => onDelete?.(position)} className="text-zinc-500 transition-colors hover:text-rose-300">
                        Eliminar
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
