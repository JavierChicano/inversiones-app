'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBackdropClose } from '@/lib/hooks/useBackdropClose';
import { CloseIcon } from '@/components/icons';
import { formatReportPeriod } from '@/lib/utils/formatters';

const MAX_REPORT_BYTES = 4 * 1024 * 1024;

function toMonthKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  return { periodStart: toMonthKey(start), periodEnd: toMonthKey(now) };
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const INPUT_CLASS =
  'w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500';

/**
 * Modal para subir una radiografía de cartera (HTML). Llama a onUploaded(report) al guardar.
 */
export default function UploadReportModal({ isOpen, onClose, onUploaded }) {
  const { token } = useAuth();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('Radiografía de cartera');
  const [period, setPeriod] = useState(defaultPeriod);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (isUploading) return;
    setFile(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const backdropProps = useBackdropClose(handleClose);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('No autorizado. Inicia sesión de nuevo.');
      return;
    }

    if (!file) {
      setError('Selecciona un archivo HTML.');
      return;
    }

    if (!/\.html?$/i.test(file.name)) {
      setError('El archivo debe tener extensión .html o .htm.');
      return;
    }

    if (file.size > MAX_REPORT_BYTES) {
      setError('El informe supera el tamaño máximo permitido (4 MB).');
      return;
    }

    if (period.periodStart > period.periodEnd) {
      setError('El mes inicial no puede ser posterior al mes final.');
      return;
    }

    try {
      setIsUploading(true);
      const html = await file.text();

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          html,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar el informe');
      }

      onUploaded?.(data.report);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
    } catch (err) {
      setError(err.message || 'Error al subir el informe');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      {...backdropProps}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md relative">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-1">Subir informe</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Radiografía de cartera en HTML autocontenido (máx. 4 MB).
        </p>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className={INPUT_CLASS}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Desde (mes)</label>
              <input
                type="month"
                value={period.periodStart}
                onChange={(e) => setPeriod((prev) => ({ ...prev, periodStart: e.target.value }))}
                className={`${INPUT_CLASS} [color-scheme:dark]`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Hasta (mes)</label>
              <input
                type="month"
                value={period.periodEnd}
                onChange={(e) => setPeriod((prev) => ({ ...prev, periodEnd: e.target.value }))}
                className={`${INPUT_CLASS} [color-scheme:dark]`}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Archivo HTML</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={(e) => {
                setError('');
                setFile(e.target.files?.[0] || null);
              }}
              className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border file:border-zinc-700 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-200 file:cursor-pointer hover:file:bg-zinc-700"
            />
          </div>

          <p className="text-xs text-zinc-500">
            Periodo: <span className="capitalize">{formatReportPeriod(period.periodStart, period.periodEnd)}</span>
            {file && ` · ${file.name} (${formatBytes(file.size)})`}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-secondary rounded-lg">
              Cancelar
            </button>
            <button type="submit" disabled={isUploading || !file} className="btn-primary rounded-lg">
              {isUploading ? 'Subiendo...' : 'Subir informe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
