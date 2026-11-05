'use client';

import { useMemo, useState } from 'react';
import { CloseIcon } from '@/components/icons';
import { useBackdropClose } from '@/lib/hooks/useBackdropClose';
import Amount from '@/components/Amount';
import { formatPrice, formatSignedPercent, formatUsd, toDateTimeLocalValue } from '@/lib/utils/formatters';
import { CLOSE_REASONS, CLOSE_REASON_LABELS, DIRECTION_LABELS, LIQUIDATION_LEVEL, settleLeveragedPosition } from '@/lib/utils/leverage';

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-fuchsia-500 focus:outline-none disabled:opacity-60';
const LABEL_CLASS = 'mb-2 block text-sm font-medium text-zinc-400';

function pnlClass(value) {
  return value >= 0 ? 'text-emerald-300' : 'text-rose-300';
}

function buildInitialForm(position) {
  const currentPrice = Number(position?.currentPrice || 0);
  return {
    reason: 'MANUAL',
    closePrice: currentPrice > 0 ? String(currentPrice) : '',
    closeFee: '0',
    closedAt: toDateTimeLocalValue(new Date()),
  };
}

/**
 * El padre lo renderiza con `key={position.id}`: al cambiar de posición el componente se
 * remonta y el estado inicial (precio actual, fecha) se recalcula sin necesidad de efectos.
 */
export default function CloseLeveragedPositionModal({ isOpen, onClose, onSubmit, position }) {
  const [formData, setFormData] = useState(() => buildInitialForm(position));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const backdropProps = useBackdropClose(onClose);

  const isLiquidation = formData.reason === 'LIQUIDATION';

  const preview = useMemo(() => {
    if (!position) return null;
    const closePrice = Number(formData.closePrice) || 0;
    if (!isLiquidation && closePrice <= 0) return null;

    return settleLeveragedPosition(position, {
      closePrice: closePrice > 0 ? closePrice : undefined,
      closeFee: Number(formData.closeFee) || 0,
      closedAt: formData.closedAt ? new Date(formData.closedAt) : new Date(),
      reason: formData.reason,
    });
  }, [position, formData, isLiquidation]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleReasonChange = (event) => {
    const reason = event.target.value;
    setFormData((previous) => {
      let closePrice = previous.closePrice;
      if (reason === 'LIQUIDATION') closePrice = position?.liquidationPrice ? String(position.liquidationPrice) : '';
      if (reason === 'STOP_LOSS' && position?.stopLoss) closePrice = String(position.stopLoss);
      if (reason === 'TAKE_PROFIT' && position?.takeProfit) closePrice = String(position.takeProfit);
      return { ...previous, reason, closePrice };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!position) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        reason: formData.reason,
        closePrice: formData.closePrice === '' ? null : parseFloat(formData.closePrice),
        closeFee: parseFloat(formData.closeFee) || 0,
        closedAt: new Date(formData.closedAt).toISOString(),
      });
      onClose();
    } catch (error) {
      console.error('Error cerrando posición apalancada:', error);
      setSubmitError(error.message || 'No fue posible cerrar la posición');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !position) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" {...backdropProps}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Cerrar posición</h3>
            <p className="text-sm text-zinc-400">
              {position.assetTicker} · {DIRECTION_LABELS[position.direction] || position.direction} x{position.leverage} · entrada{' '}
              {formatPrice(position.entryPrice)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 transition-colors hover:text-white">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Motivo de cierre</label>
              <select name="reason" value={formData.reason} onChange={handleReasonChange} className={INPUT_CLASS}>
                {CLOSE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {CLOSE_REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>
                Precio de cierre / unidad {!isLiquidation && <span className="text-red-400">*</span>}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                name="closePrice"
                value={formData.closePrice}
                onChange={handleChange}
                required={!isLiquidation}
                placeholder={isLiquidation ? formatPrice(position.liquidationPrice) : '0.00'}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-zinc-500">
                {isLiquidation
                  ? `Opcional: si se deja vacío se usa el precio de liquidación estimado (${formatPrice(position.liquidationPrice)}).`
                  : position.currentPrice > 0
                    ? `Precio actual: ${formatPrice(position.currentPrice)}`
                    : 'Sin precio actual disponible'}
              </p>
            </div>

            <div>
              <label className={LABEL_CLASS}>Comisión de cierre (USD)</label>
              <input type="number" step="any" min="0" name="closeFee" value={formData.closeFee} onChange={handleChange} className={INPUT_CLASS} />
            </div>

            <div>
              <label className={LABEL_CLASS}>
                Fecha y hora de cierre <span className="text-red-400">*</span>
              </label>
              <input type="datetime-local" name="closedAt" value={formData.closedAt} onChange={handleChange} required className={INPUT_CLASS} />
            </div>
          </div>

          {isLiquidation && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              Liquidación / margin call: la pérdida bruta se fija automáticamente en el {LIQUIDATION_LEVEL * 100} % de la garantía (
              <Amount>{formatUsd(LIQUIDATION_LEVEL * position.margin)}</Amount>) más las comisiones acumuladas hasta la fecha.
            </p>
          )}

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Resultado estimado</p>
            {preview ? (
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-zinc-500">Días mantenida</p>
                  <p className="mt-1 font-semibold text-white">{preview.daysHeld}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Comisiones totales</p>
                  <p className="mt-1 font-semibold text-amber-300">
                    <Amount>{formatUsd(preview.totalFees)}</Amount>
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    swap <Amount>{formatUsd(preview.swapTotal)}</Amount>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">P&amp;L bruto</p>
                  <p className={`mt-1 font-semibold ${pnlClass(preview.grossPnl)}`}>
                    <Amount>{formatUsd(preview.grossPnl)}</Amount>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">P&amp;L neto</p>
                  <p className={`mt-1 font-semibold ${pnlClass(preview.netPnl)}`}>
                    <Amount>{formatUsd(preview.netPnl)}</Amount>
                  </p>
                  <p className={`text-[11px] ${pnlClass(preview.roi)}`}>ROI {formatSignedPercent(preview.roi)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">Introduce el precio de cierre para ver el resultado.</p>
            )}
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
              disabled={isSubmitting || (!isLiquidation && !(Number(formData.closePrice) > 0))}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Cerrando...' : 'Cerrar posición'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
