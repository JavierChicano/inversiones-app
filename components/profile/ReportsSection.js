'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { EyeIcon, TrashIcon } from '@/components/icons';
import { formatReportPeriod } from '@/lib/utils/formatters';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Listado de informes (radiografías de cartera) con acciones ver / eliminar.
 * `refreshKey` fuerza una recarga (p. ej. tras subir un informe desde el modal).
 */
export default function ReportsSection({ refreshKey = 0 }) {
  const { token } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchReports = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener informes');
      }

      setReports(data.reports || []);
    } catch (err) {
      setError(err.message || 'Error al obtener informes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports, refreshKey]);

  const handleDelete = async (report) => {
    if (!token) return;

    const confirmed = window.confirm(
      `¿Eliminar el informe "${report.title}" (${formatReportPeriod(report.periodStart, report.periodEnd)})?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(report.id);
      setError('');
      const response = await fetch(`/api/reports/${report.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo eliminar el informe');
      }

      setReports((prev) => prev.filter((item) => item.id !== report.id));
    } catch (err) {
      setError(err.message || 'Error al eliminar el informe');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 bg-zinc-800/60 rounded-lg" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="text-zinc-500 text-sm">
          Aún no has subido ningún informe. Usa el botón «Subir informe» para guardar la radiografía de tu cartera.
        </p>
      ) : (
        <ul className="space-y-2">
          {reports.map((report) => (
            <li
              key={report.id}
              className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 hover:border-zinc-700 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-white text-sm font-semibold truncate">{report.title}</span>
                  <span className="text-sm text-zinc-400 capitalize">
                    {formatReportPeriod(report.periodStart, report.periodEnd)}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  Subido el {formatDate(report.createdAt)} · {formatBytes(report.sizeBytes)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/reports/${report.id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary rounded-lg gap-1.5 !py-1.5 text-xs"
                >
                  <EyeIcon className="w-4 h-4" />
                  Ver
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(report)}
                  disabled={deletingId === report.id}
                  className="inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-1.5 text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Eliminar informe ${report.title}`}
                  title="Eliminar"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
