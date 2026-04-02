'use client';

import { useEffect, useMemo, useState } from 'react';
import { CloseIcon } from '@/components/icons';

function formatCoin(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(Number(value) || 0);
}

function formatPercentage(value) {
  return `${(Number(value) || 0).toFixed(2)}%`;
}

export default function UnstakeStakingModal({ isOpen, onClose, onSubmit, position }) {
  const [amountToUnstake, setAmountToUnstake] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const principalAmount = Number(position?.amountStaked || 0);
  const currentAmount = Number(amountToUnstake || 0);
  const estimatedReward = useMemo(() => {
    if (!position || !principalAmount || principalAmount <= 0) return 0;

    const startDate = new Date(position.startDate);
    const daysHeld = Math.max(
      1,
      Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    return Number(
      (principalAmount * (Number(position.manualApy || 0) / 100) * (daysHeld / 365)).toFixed(8)
    );
  }, [position, principalAmount]);

  const maxAmount = Number((principalAmount + estimatedReward).toFixed(8));

  useEffect(() => {
    if (isOpen && position) {
      setAmountToUnstake(maxAmount > 0 ? maxAmount.toFixed(8) : '');
    }
  }, [isOpen, position, maxAmount]);

  const estimatedDays = useMemo(() => {
    if (!position) return 0;

    const startDate = new Date(position.startDate);
    return Math.max(1, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  }, [position]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!position || currentAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        amountToUnstake: Number(amountToUnstake),
      });
      setAmountToUnstake('');
      onClose();
    } catch (error) {
      console.error('Error retirando staking:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !position) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Retirar staking</h3>
            <p className="text-sm text-zinc-400">
              Retirada numérica sin slider. El total estimado es una referencia; si introduces más, el excedente se registra como recompensa adicional.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 transition-colors hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Posición</p>
                <p className="mt-1 font-semibold text-white">{position.assetTicker}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Principal</p>
                <p className="mt-1 font-semibold text-cyan-300">
                  {formatCoin(principalAmount)} {position.assetTicker}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-400">
              <div>
                <span className="text-zinc-500">APY actual:</span>{' '}
                <span className="text-emerald-300">{formatPercentage(position.manualApy)}</span>
              </div>
              <div>
                <span className="text-zinc-500">Días en staking:</span>{' '}
                <span className="text-zinc-300">{estimatedDays} días</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-zinc-300">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Recompensa estimada</span>
                <span className="font-semibold text-emerald-300">
                  {formatCoin(estimatedReward)} {position.assetTicker}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-zinc-500">Total estimado a retirar</span>
                <span className="font-semibold text-white">
                  {formatCoin(maxAmount)} {position.assetTicker}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-400">
              Cantidad total a retirar <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={amountToUnstake}
              onChange={(event) => setAmountToUnstake(event.target.value)}
              required
              placeholder="0.00"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Si introduces una cantidad superior al principal, el excedente se interpreta como recompensa adicional.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Recompensa estimada</p>
              <p className="mt-1 font-semibold text-white">
                {formatCoin(estimatedReward)} {position.assetTicker}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">APY real estimado</p>
              <p className="mt-1 font-semibold text-white">
                {position.manualApy ? formatPercentage(position.manualApy) : '0.00%'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || currentAmount <= 0}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Procesando...' : 'Retirar staking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
