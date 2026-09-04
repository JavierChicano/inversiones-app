'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { EditIcon, EyeIcon, TrashIcon } from '@/components/icons';
import { formatReportPeriod } from '@/lib/utils/formatters';
import { MAX_REPORT_NOTES_LENGTH } from '@/lib/utils/reports';

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
 * Notas y apuntes de un informe: muestra el texto guardado y permite editarlo en línea.
 * onSave(notes) debe devolver una promesa (lanza error si falla).
 */
function ReportNotes({ notes, editing, onEdit, onCancel, onSave }) {
  const [draft, setDraft] = useState(notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sincronizar el borrador al abrir el editor (o si las notas cambian desde fuera)
  useEffect(() => {
    if (editing) {
      setDraft(notes || '');
      setError('');
    }
  }, [editing, notes]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await onSave(draft.trim());
    } catch (err) {
      setError(err.message || 'Error al guardar las notas');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="mt-2 pt-2 border-t border-zinc-800 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_REPORT_NOTES_LENGTH}
          rows={4}
          autoFocus
          placeholder="Conclusiones, decisiones tomadas, cosas a vigilar..."
          className="w-full bg-zinc-800 text-white text-sm border border-zinc-700 rounded-lg px-3 py-2 resize-y focus:outline-none focus:border-blue-500"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">
            {draft.length.toLocaleString('es-ES')} / {MAX_REPORT_NOTES_LENGTH.toLocaleString('es-ES')}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="btn-secondary rounded-lg !py-1 text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary rounded-lg !py-1 text-xs"
            >
              {saving ? 'Guardando...' : 'Guardar notas'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!notes) return null;

  return (
    <button
      type="button"
      onClick={onEdit}
      className="mt-2 pt-2 border-t border-zinc-800 w-full text-left group"
      title="Editar notas"
    >
      <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words group-hover:text-white transition-colors">
        {notes}
      </p>
    </button>
  );
}

/**
 * Listado de informes (radiografías de cartera) con acciones ver / notas / eliminar.
 * `refreshKey` fuerza una recarga (p. ej. tras subir un informe desde el modal).
 */
export default function ReportsSection({ refreshKey = 0 }) {
  const { token } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [editingNotesId, setEditingNotesId] = useState(null);

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

  const handleSaveNotes = async (report, notes) => {
    if (!token) throw new Error('No autorizado. Inicia sesión de nuevo.');

    const response = await fetch(`/api/reports/${report.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notes }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudieron guardar las notas');
    }

    setReports((prev) => prev.map((item) => (item.id === report.id ? { ...item, ...data.report } : item)));
    setEditingNotesId(null);
  };

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
              className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 hover:border-zinc-700 transition-colors"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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
                    onClick={() => setEditingNotesId((current) => (current === report.id ? null : report.id))}
                    className={`btn-secondary rounded-lg gap-1.5 !py-1.5 text-xs ${
                      editingNotesId === report.id ? '!border-blue-500 text-blue-400' : ''
                    }`}
                    aria-label={`${report.notes ? 'Editar' : 'Añadir'} notas del informe ${report.title}`}
                    title={report.notes ? 'Editar notas' : 'Añadir notas'}
                  >
                    <EditIcon className="w-4 h-4" />
                    Notas
                  </button>
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
              </div>

              <ReportNotes
                notes={report.notes}
                editing={editingNotesId === report.id}
                onEdit={() => setEditingNotesId(report.id)}
                onCancel={() => setEditingNotesId(null)}
                onSave={(notes) => handleSaveNotes(report, notes)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
