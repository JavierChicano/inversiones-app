'use client';

import { useMemo, useState } from 'react';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { useBackdropClose } from '@/lib/hooks/useBackdropClose';
import { formatCoin, formatPrice, formatUsd, toDateTimeLocalValue } from '@/lib/utils/formatters';
import {
  LEVERAGED_ASSET_TYPE_LABELS,
  LIQUIDATION_LEVEL,
  calculateExposure,
  calculateLiquidationPrice,
  calculateQuantity,
} from '@/lib/utils/leverage';

const ASSET_TYPES = ['STOCK', 'CRYPTO', 'INDEX', 'FIAT'];
const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20];

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-fuchsia-500 focus:outline-none';
const LABEL_CLASS = 'mb-2 block text-sm font-medium text-zinc-400';

function initialForm() {
  return {
    assetType: 'STOCK',
    assetTicker: '',
    direction: 'LONG',
    margin: '',
    leverage: '5',
    entryPrice: '',
    openFee: '0',
    dailySwap: '0',
    notes: '',
    openedAt: toDateTimeLocalValue(new Date()),
  };
}

function Field({ label, required = false, hint, children }) {
  return (
    <div>
      <label className={LABEL_CLASS}>
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export default function AddLeveragedPositionModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const backdropProps = useBackdropClose(onClose);

  const preview = useMemo(() => {
    const margin = Number(formData.margin) || 0;
    const leverage = Number(formData.leverage) || 0;
    const entryPrice = Number(formData.entryPrice) || 0;
    const exposure = calculateExposure(margin, leverage);
    const quantity = calculateQuantity(exposure, entryPrice);
    const position = { direction: formData.direction, entryPrice, margin, quantity };
    const liquidationPrice = entryPrice > 0 && quantity > 0 ? calculateLiquidationPrice(position) : 0;

    return { margin, leverage, entryPrice, exposure, quantity, liquidationPrice };
  }, [formData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const setField = (name, value) => setFormData((previous) => ({ ...previous, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit({
        assetTicker: formData.assetTicker.trim().toUpperCase(),
        assetType: formData.assetType,
        direction: formData.direction,
        margin: parseFloat(formData.margin),
        leverage: parseFloat(formData.leverage),
        entryPrice: parseFloat(formData.entryPrice),
        openFee: parseFloat(formData.openFee) || 0,
        dailySwap: parseFloat(formData.dailySwap) || 0,
        notes: formData.notes,
        openedAt: new Date(formData.openedAt).toISOString(),
      });
      setFormData(initialForm());
      onClose();
    } catch (error) {
      console.error('Error abriendo posición apalancada:', error);
      setSubmitError(error.message || 'No fue posible abrir la posición');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isLong = formData.direction === 'LONG';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" {...backdropProps}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Nueva transacción · Apalancar</h3>
            <p className="text-sm text-zinc-400">
              Introduce la garantía y el multiplicador: la exposición, la cantidad y el precio de liquidación se calculan solos.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 transition-colors hover:text-white">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {/* A. Datos principales del activo */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300">A · Activo</legend>

            <Field label="Tipo de asset" required>
              <div className="grid grid-cols-4 gap-2">
                {ASSET_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setField('assetType', type)}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      formData.assetType === type
                        ? 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-200'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {LEVERAGED_ASSET_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Ticker" required hint={formData.assetType === 'FIAT' ? 'Par de divisas, ej. EURUSD o GBP/USD' : 'Ej. TTWO, AMD, NVDA, BTC, SPX'}>
                <input
                  type="text"
                  name="assetTicker"
                  value={formData.assetTicker}
                  onChange={(event) => setField('assetTicker', event.target.value.toUpperCase())}
                  required
                  maxLength={20}
                  placeholder="TTWO"
                  className={`${INPUT_CLASS} uppercase`}
                />
              </Field>

              <Field label="Dirección de la operación" required>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setField('direction', 'LONG')}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      isLong ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Largo / Long
                  </button>
                  <button
                    type="button"
                    onClick={() => setField('direction', 'SHORT')}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      !isLong ? 'border-rose-500 bg-rose-500/20 text-rose-200' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Corto / Short
                  </button>
                </div>
              </Field>
            </div>
          </fieldset>

          {/* B. Posición y capital */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300">B · Posición y capital</legend>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Garantía (margen) USD" required>
                <input type="number" step="any" min="0" name="margin" value={formData.margin} onChange={handleChange} required placeholder="1000" className={INPUT_CLASS} />
              </Field>

              <Field label="Multiplicador" required>
                <div className="flex gap-2">
                  <input type="number" step="any" min="1" max="500" name="leverage" value={formData.leverage} onChange={handleChange} required className={INPUT_CLASS} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {LEVERAGE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setField('leverage', String(preset))}
                      className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                        Number(formData.leverage) === preset
                          ? 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-200'
                          : 'border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      x{preset}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Precio de entrada / unidad" required>
                <input type="number" step="any" min="0" name="entryPrice" value={formData.entryPrice} onChange={handleChange} required placeholder="0.00" className={INPUT_CLASS} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Exposición total</p>
                <p className="mt-1 font-semibold text-white">{formatUsd(preview.exposure)}</p>
                <p className="text-[11px] text-zinc-500">
                  {formatUsd(preview.margin)} × {preview.leverage || 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Cantidad / unidades</p>
                <p className="mt-1 font-semibold text-white">{formatCoin(preview.quantity, { maximumFractionDigits: 6 })}</p>
                <p className="text-[11px] text-zinc-500">exposición / precio de entrada</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Liquidación estimada</p>
                <p className="mt-1 font-semibold text-amber-300">{preview.liquidationPrice > 0 ? formatPrice(preview.liquidationPrice) : '-'}</p>
                <p className="text-[11px] text-zinc-500">pérdida del {LIQUIDATION_LEVEL * 100} % de la garantía</p>
              </div>
            </div>
          </fieldset>

          {/* C. Comisiones y fecha */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300">C · Comisiones y fecha</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Comisión de apertura (USD)">
                <input type="number" step="any" min="0" name="openFee" value={formData.openFee} onChange={handleChange} className={INPUT_CLASS} />
              </Field>
              <Field label="Swap diario (USD / noche)" hint="Se acumula por cada noche abierta">
                <input type="number" step="any" min="0" name="dailySwap" value={formData.dailySwap} onChange={handleChange} className={INPUT_CLASS} />
              </Field>
              <Field label="Fecha y hora de apertura" required hint="Puede ser pasada si registras una operación antigua">
                <input type="datetime-local" name="openedAt" value={formData.openedAt} onChange={handleChange} required className={INPUT_CLASS} />
              </Field>
            </div>
            <Field label="Notas">
              <input type="text" name="notes" value={formData.notes} onChange={handleChange} maxLength={500} placeholder="Tesis de la operación, bróker, etc." className={INPUT_CLASS} />
            </Field>
          </fieldset>

          {submitError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{submitError}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusIcon className="h-4 w-4" />
              {isSubmitting ? 'Abriendo...' : 'Abrir posición'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
