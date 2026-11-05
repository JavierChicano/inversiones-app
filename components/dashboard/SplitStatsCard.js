'use client';

import Amount from '../Amount';

const ICON_COLORS = {
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  green: 'bg-green-500/10 text-green-500 border-green-500/20',
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  red: 'bg-red-500/10 text-red-500 border-red-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

/** Color de cada segmento del desglose (identifica el tipo de operativa, no el signo). */
const SEGMENT_TONES = {
  spot: { dot: 'bg-sky-400', label: 'text-sky-300/80', border: 'border-sky-500/20', bg: 'bg-sky-500/5' },
  cfd: { dot: 'bg-fuchsia-400', label: 'text-fuchsia-300/80', border: 'border-fuchsia-500/20', bg: 'bg-fuchsia-500/5' },
};

/**
 * Tarjeta con un valor principal destacado y un desglose por segmentos (contado / CFD) debajo.
 *
 * - layout "columns" (por defecto): cajas en columnas, todas con la misma altura y alineadas al
 *   pie de la tarjeta, así que las tarjetas vecinas quedan a la misma línea.
 * - layout "rows": sin valor principal; cada segmento es una fila (etiqueta a la izquierda,
 *   valor a la derecha). Útil para magnitudes que no se suman, como el tiempo de posesión.
 *
 * @param {{ label: string, value: import('react').ReactNode, hint?: import('react').ReactNode, tone?: 'spot'|'cfd', valueClassName?: string }[]} segments
 */
export default function SplitStatsCard({
  title,
  value,
  subValue,
  icon,
  color = 'blue',
  segments = [],
  sensitive = false,
  valueClassName = 'text-white',
  layout = 'columns',
}) {
  const wrap = (node) => (sensitive ? <Amount>{node}</Amount> : node);
  const hasPrimary = layout === 'columns' && value !== undefined && value !== null;

  return (
    <div className="lg:h-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors flex flex-col">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        {icon && <div className={`p-2 rounded-lg border ${ICON_COLORS[color] || ICON_COLORS.blue}`}>{icon}</div>}
      </div>

      {hasPrimary && (
        <div className="mt-3">
          <div className={`text-2xl font-bold ${valueClassName}`}>{wrap(value)}</div>
          <div className="mt-0.5 min-h-4 text-xs text-zinc-500">{subValue ? wrap(subValue) : null}</div>
        </div>
      )}

      {layout === 'rows' ? (
        <div className="mt-auto space-y-2 pt-3">
          {segments.map((segment) => {
            const tone = SEGMENT_TONES[segment.tone] || SEGMENT_TONES.spot;
            return (
              <div
                key={segment.label}
                className={`flex h-[58px] items-center justify-between gap-3 rounded-lg border ${tone.border} ${tone.bg} px-3`}
              >
                <div className="min-w-0">
                  <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${tone.label}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {segment.label}
                  </div>
                  {segment.hint && <div className="mt-0.5 truncate text-[11px] text-zinc-500">{wrap(segment.hint)}</div>}
                </div>
                <div className={`shrink-0 text-lg font-bold tabular-nums ${segment.valueClassName || 'text-zinc-100'}`}>
                  {wrap(segment.value)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        segments.length > 0 && (
          <div
            className="mt-auto grid gap-2 border-t border-zinc-800 pt-3"
            style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
          >
            {segments.map((segment) => {
              const tone = SEGMENT_TONES[segment.tone] || SEGMENT_TONES.spot;
              return (
                <div key={segment.label} className={`h-[78px] min-w-0 rounded-lg border ${tone.border} ${tone.bg} px-2.5 py-2`}>
                  <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${tone.label}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {segment.label}
                  </div>
                  <div className={`mt-1 truncate text-base font-semibold ${segment.valueClassName || 'text-zinc-100'}`}>
                    {wrap(segment.value)}
                  </div>
                  {/* La línea de pista siempre ocupa su sitio para que todas las cajas midan lo mismo */}
                  <div className="mt-0.5 min-h-4 truncate text-[11px] text-zinc-500">{segment.hint ? wrap(segment.hint) : null}</div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
