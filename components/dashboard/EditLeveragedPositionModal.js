'use client';

import { useState } from 'react';
import { CloseIcon } from '@/components/icons';
import { useBackdropClose } from '@/lib/hooks/useBackdropClose';
import { formatPrice, toDateTimeLocalValue } from '@/lib/utils/formatters';
import { DIRECTION_LABELS } from '@/lib/utils/leverage';

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-fuchsia-500 focus:outline-none';
const LABEL_CLASS = 'mb-2 block text-sm font-medium text-zinc-400';

function toInput(value) {
  return value === null || value === undefined ? '' : String(value);
}

function buildForm(position) {
  return {
    openedAt: position?.openedAt ? toDateTimeLocalValue(position.openedAt) : toDateTimeLocalValue(new Date()),
    dailySwap: toInput(position?.dailySwap ?? 0),
    openFee: toInput(position?.openFee ?? 0),
    notes: position?.notes || '',
  };
}

/** El padre lo renderiza con `key={position.id}` para que el formulario se reinicie al cambiar de posición. */
export default function EditLeveragedPositionModal({ isOpen, onClose, onSubmit, position }) {
  const [formData, setFormData] = useState(() => buildForm(position));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const backdropProps = useBackdropClose(onClose);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!position) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        openedAt: new Date(formData.openedAt).toISOString(),
        dailySwap: parseFloat(formData.dailySwap) || 0,
        openFee: parseFloat(formData.openFee) || 0,
        notes: formData.notes,
      });
      onClose();
    } catch (error) {
      console.error('Error actualizando posición apalancada:', error);
      setSubmitError(error.message || 'No fue posible actualizar la posición');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !position) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" {...backdropProps}>
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Editar posición</h3>
            <p className="text-sm text-zinc-400">
              {position.assetTicker} · {DIRECTION_LABELS[position.direction] || position.direction} x{position.leverage} · entrada{' '}
              {formatPrice(position.entryPrice)} · liquidación {formatPrice(position.liquidationPrice)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 transition-colors hover:text-white">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>
                Fecha y hora de apertura <span className="text-red-400">*</span>
              </label>
              <input type="datetime-local" name="openedAt" value={formData.openedAt} onChange={handleChange} required className={INPUT_CLASS} />
              <p className="mt-1 text-xs text-zinc-500">Corrígela si registraste una posición pasada: las noches de swap se recalculan desde esta fecha.</p>
            </div>
            <div>
              <label className={LABEL_CLASS}>Swap diario (USD / noche)</label>
              <input type="number" step="any" min="0" name="dailySwap" value={formData.dailySwap} onChange={handleChange} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Comisión de apertura (USD)</label>
              <input type="number" step="any" min="0" name="openFee" value={formData.openFee} onChange={handleChange} className={INPUT_CLASS} />
            </div>
            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Notas</label>
              <input type="text" name="notes" value={formData.notes} onChange={handleChange} maxLength={500} className={INPUT_CLASS} />
            </div>
          </div>

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
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
