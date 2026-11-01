'use client';

import { Fragment, useState } from 'react';
import Amount from '../Amount';
import { formatUsd } from '@/lib/utils/formatters';

function formatCoin(value, ticker) {
  return `${(Number(value) || 0).toFixed(4)} ${ticker}`;
}

function getElapsedDaysSince(startDate) {
  if (!startDate) return 0;

  const parsedDate = new Date(startDate);
  if (Number.isNaN(parsedDate.getTime())) return 0;

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((Date.now() - parsedDate.getTime()) / msPerDay));
}

function formatDateTime(value) {
  if (!value) return '-';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '-';

  return parsedDate.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getEventLabel(eventType) {
  if (eventType === 'CLOSE') return 'Cierre';
  if (eventType === 'UNSTAKE') return 'Retirada parcial';
  return 'Alta / aporte';
}

function getEventBadgeClass(eventType) {
  if (eventType === 'CLOSE') {
    return 'bg-rose-500/15 text-rose-300';
  }

  if (eventType === 'UNSTAKE') {
    return 'bg-amber-500/15 text-amber-300';
  }

  return 'bg-cyan-500/15 text-cyan-300';
}

export default function StakingPositionsTable({ positions = [], onUnstake }) {
  const [expandedPositionId, setExpandedPositionId] = useState(null);

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
            <th className="px-4 py-3 text-right">Recompensa acumulada</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const elapsedDays = getElapsedDaysSince(position.startDate);
            const nonEarningDays = 3;
            const earningDays = Math.max(0, elapsedDays - nonEarningDays);
            const pendingRewardCoin = Number(position.pendingRewardAmount || 0);
            const accumulatedRewardCoin = pendingRewardCoin || (position.projection?.daily?.coin || 0) * earningDays;
            const accumulatedRewardUsd = accumulatedRewardCoin * Number(position.currentPrice || 0);
            const movementHistory = [...(position.movements || [])].sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
            const isExpanded = expandedPositionId === position.id;

            return (
              <Fragment key={position.id}>
                <tr className="border-b border-zinc-800/60 text-zinc-200 last:border-b-0">
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold text-white">{position.assetTicker}</div>
                    <div className="text-xs text-zinc-500">{position.assetName || '-'}</div>
                    <button
                      type="button"
                      onClick={() => setExpandedPositionId(isExpanded ? null : position.id)}
                      className="mt-2 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200"
                    >
                      {isExpanded ? 'Ocultar desglose' : 'Ver desglose'}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-cyan-200 align-top">
                    <Amount>{formatCoin(position.amountStaked, position.assetTicker)}</Amount>
                  </td>
                  <td className="px-4 py-4 text-right text-emerald-300 align-top">
                    {Number(position.manualApy || 0).toFixed(2)}%
                  </td>
                  <td className="px-4 py-4 text-right text-zinc-300 align-top">
                    {position.lockPeriodDays || 0} días
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <div className="space-y-1">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-zinc-500">Día</span>
                        <span className="font-medium text-zinc-200">
                          <Amount>{formatCoin(position.projection?.daily?.coin, position.assetTicker)}</Amount>
                        </span>
                        <span className="inline-flex w-12 justify-end text-xs text-zinc-500">
                          <Amount>{formatUsd(position.projection?.daily?.usd)}</Amount>
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-zinc-500">Mes</span>
                        <span className="font-medium text-zinc-200">
                          <Amount>{formatCoin(position.projection?.monthly?.coin, position.assetTicker)}</Amount>
                        </span>
                        <span className="inline-flex w-12 justify-end text-xs text-zinc-500">
                          <Amount>{formatUsd(position.projection?.monthly?.usd)}</Amount>
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-zinc-500">Año</span>
                        <span className="font-medium text-zinc-200">
                          <Amount>{formatCoin(position.projection?.annual?.coin, position.assetTicker)}</Amount>
                        </span>
                        <span className="inline-flex w-12 justify-end text-xs text-zinc-500">
                          <Amount>{formatUsd(position.projection?.annual?.usd)}</Amount>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <div className="font-semibold text-emerald-300">
                      <Amount>{formatCoin(accumulatedRewardCoin, position.assetTicker)}</Amount>
                    </div>
                    <div className="text-xs text-emerald-400/80">
                      <Amount>{formatUsd(accumulatedRewardUsd)}</Amount>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {pendingRewardCoin > 0 ? (
                        <>
                          <Amount>{formatCoin(pendingRewardCoin, position.assetTicker)}</Amount> pendientes de cobro al cerrar
                        </>
                      ) : (
                        `${earningDays} días generando (3 de lock)`
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <button
                      type="button"
                      onClick={() => onUnstake?.(position)}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
                    >
                      Retirar
                    </button>
                  </td>
                </tr>

                {isExpanded && (
                  <tr className="border-b border-zinc-800/60 bg-zinc-950/40">
                    <td colSpan="7" className="px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                          <h4 className="text-sm font-semibold text-white">Resumen de posición</h4>
                          <div className="mt-3 space-y-2 text-sm text-zinc-300">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-zinc-500">Abierta desde</span>
                              <span>{formatDateTime(position.startDate)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-zinc-500">Último cambio</span>
                              <span>{formatDateTime(position.lastAccrualAt || position.startDate)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-zinc-500">Recompensa pendiente</span>
                              <span className="font-semibold text-emerald-300">
                                {formatCoin(position.pendingRewardAmount || 0, position.assetTicker)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-zinc-500">Recompensa cobrada</span>
                              <span className="font-semibold text-cyan-300">
                                {formatCoin(position.totalClaimedReward || 0, position.assetTicker)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                          <h4 className="text-sm font-semibold text-white">Historial de cambios</h4>
                          {movementHistory.length === 0 ? (
                            <p className="mt-3 text-sm text-zinc-500">Todavía no hay cambios registrados para esta posición.</p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {movementHistory.map((event) => {
                                const delta = Number(event.principalDelta || event.principalAmount || 0);
                                const isPositive = delta >= 0;

                                return (
                                  <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                      <div>
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getEventBadgeClass(event.eventType)}`}>
                                          {getEventLabel(event.eventType)}
                                        </span>
                                        <p className="mt-2 text-xs text-zinc-500">{formatDateTime(event.createdAt)}</p>
                                        {event.note && (
                                          <p className="mt-1 text-xs text-zinc-400">{event.note}</p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs uppercase tracking-wide text-zinc-500">Recompensa del periodo</p>
                                        <p className="text-sm font-semibold text-emerald-300">
                                          {formatCoin(event.rewardAccrued || 0, position.assetTicker)}
                                        </p>
                                        {Number(event.rewardClaimed || 0) > 0 && (
                                          <p className="text-xs text-cyan-300">
                                            Cobrada: {formatCoin(event.rewardClaimed || 0, position.assetTicker)}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-300 md:grid-cols-4">
                                      <div>
                                        <p className="text-zinc-500">Antes</p>
                                        <p className="mt-1 font-semibold text-white">
                                          {formatCoin(event.principalBefore, position.assetTicker)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-zinc-500">Movimiento</p>
                                        <p className={`mt-1 font-semibold ${isPositive ? 'text-cyan-300' : 'text-amber-300'}`}>
                                          {isPositive ? '+' : ''}{formatCoin(delta, position.assetTicker)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-zinc-500">Después</p>
                                        <p className="mt-1 font-semibold text-white">
                                          {formatCoin(event.principalAfter, position.assetTicker)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-zinc-500">Pendiente tras evento</p>
                                        <p className="mt-1 font-semibold text-emerald-300">
                                          {formatCoin(event.pendingRewardAfter || 0, position.assetTicker)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
