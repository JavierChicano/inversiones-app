'use client';

import { useMemo, useState } from 'react';
import { CloseIcon, PlusIcon } from '@/components/icons';

function formatCoin(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(Number(value) || 0);
}

export default function AddStakingPositionModal({ isOpen, onClose, onSubmit, assets = [], holdings = [] }) {
  const [formData, setFormData] = useState({
    assetTicker: '',
    amountStaked: '',
    manualApy: '',
    lockPeriodDays: '0',
    startDate: new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedHolding = useMemo(() => {
    return holdings.find((item) => item.ticker === formData.assetTicker) || null;
  }, [holdings, formData.assetTicker]);

  const maxAvailable = Number(selectedHolding?.quantity || 0);
  const currentAmount = Number(formData.amountStaked || 0);
  const sliderPercent = maxAvailable > 0
    ? Math.min(100, Math.max(0, (currentAmount / maxAvailable) * 100))
    : 0;
  const exceedsAvailable = maxAvailable > 0 && currentAmount > maxAvailable;
  const cannotStakeSelectedAsset = !!formData.assetTicker && maxAvailable <= 0;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleAmountChange = (event) => {
    const value = event.target.value;
    setFormData((previous) => ({ ...previous, amountStaked: value }));
  };

  const handleSliderChange = (event) => {
    const percent = Number(event.target.value || 0);
    if (maxAvailable <= 0) return;

    const amountFromSlider = (maxAvailable * percent) / 100;
    setFormData((previous) => ({
      ...previous,
      amountStaked: amountFromSlider.toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'),
    }));
  };

  const resetForm = () => {
    setFormData({
      assetTicker: '',
      amountStaked: '',
      manualApy: '',
      lockPeriodDays: '0',
      startDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (cannotStakeSelectedAsset || exceedsAvailable) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        assetTicker: formData.assetTicker,
        amountStaked: parseFloat(formData.amountStaked),
        manualApy: parseFloat(formData.manualApy),
        lockPeriodDays: parseInt(formData.lockPeriodDays, 10) || 0,
        startDate: formData.startDate,
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creando staking:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Nueva posición de staking</h3>
            <p className="text-sm text-zinc-400">Registra APY manual y período de bloqueo</p>
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
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-400">
              Criptomoneda <span className="text-red-400">*</span>
            </label>
            <select
              name="assetTicker"
              value={formData.assetTicker}
              onChange={(event) => {
                const nextTicker = event.target.value;
                setFormData((previous) => ({
                  ...previous,
                  assetTicker: nextTicker,
                  amountStaked: '',
                }));
              }}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Selecciona un asset</option>
              {assets.map((asset) => (
                <option key={asset.ticker} value={asset.ticker}>
                  {asset.ticker} {asset.name ? `- ${asset.name}` : ''}
                </option>
              ))}
            </select>
            {formData.assetTicker && (
              <p className="mt-2 text-xs text-zinc-400">
                Disponible: <span className="font-medium text-cyan-300">{formatCoin(maxAvailable)} {formData.assetTicker}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Cantidad stakeada <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                name="amountStaked"
                value={formData.amountStaked}
                onChange={handleAmountChange}
                required
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
              />
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Seleccionar por porcentaje</span>
                  <span className="font-medium text-cyan-300">{sliderPercent.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={sliderPercent}
                  onChange={handleSliderChange}
                  disabled={maxAvailable <= 0}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              {cannotStakeSelectedAsset && (
                <p className="mt-2 text-xs text-amber-300">
                  No tienes balance disponible para este asset.
                </p>
              )}
              {exceedsAvailable && (
                <p className="mt-2 text-xs text-red-300">
                  La cantidad supera tu balance disponible ({formatCoin(maxAvailable)} {formData.assetTicker}).
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                APY manual (%) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                name="manualApy"
                value={formData.manualApy}
                onChange={handleChange}
                required
                placeholder="6.90"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">Lock period (días)</label>
              <input
                type="number"
                min="0"
                name="lockPeriodDays"
                value={formData.lockPeriodDays}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Fecha inicio <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
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
              disabled={isSubmitting || cannotStakeSelectedAsset || exceedsAvailable}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusIcon className="h-4 w-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar staking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
