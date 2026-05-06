'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('No autorizado. Inicia sesión de nuevo.');
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Completa todos los campos.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar la contraseña');
      }

      setSuccess('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Error al cambiar contraseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateCSV = (headers, rows) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => {
          const cellStr = String(cell ?? '');
          return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
            ? `"${cellStr.replace(/"/g, '""')}"`
            : cellStr;
        }).join(',')
      ),
    ].join('\n');

    return csvContent;
  };

  const downloadFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportData = async () => {
    setExportError('');
    setIsExporting(true);

    try {
      if (!token) {
        throw new Error('No autorizado');
      }

      // Obtener transacciones
      const transactionsResponse = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!transactionsResponse.ok) {
        throw new Error('Error al obtener transacciones');
      }

      const transactionsData = await transactionsResponse.json();
      const transactions = transactionsData.transactions || [];

      // Obtener análisis de posiciones cerradas
      const analyticsResponse = await fetch('/api/analytics/closed-positions', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!analyticsResponse.ok) {
        throw new Error('Error al obtener análisis');
      }

      const analyticsData = await analyticsResponse.json();

      // Generar CSV de transacciones
      const transactionHeaders = ['Fecha', 'Ticker', 'Tipo Asset', 'Operación', 'Cantidad', 'Precio/Unidad', 'Comisiones', 'Total USD'];
      const transactionRows = transactions.map(tx => [
        new Date(tx.date).toLocaleDateString('es-ES'),
        tx.assetTicker,
        tx.asset?.type || 'STOCK',
        tx.type === 'BUY' ? 'Compra' : 'Venta',
        tx.quantity.toFixed(8),
        tx.pricePerUnit.toFixed(2),
        tx.fees?.toFixed(2) || '0.00',
        (tx.type === 'BUY'
          ? tx.quantity * tx.pricePerUnit + (tx.fees || 0)
          : tx.quantity * tx.pricePerUnit - (tx.fees || 0)
        ).toFixed(2),
      ]);

      const transactionCSV = generateCSV(transactionHeaders, transactionRows);

      // Generar CSV de posiciones cerradas
      const closedHeaders = ['Ticker', 'Tipo', 'Operaciones', 'Ganancia Total', 'Ganancia Media', 'ROI %', 'Win Rate %', 'Trades Ganadores', 'Trades Perdedores', 'Tiempo Promedio (días)'];
      const closedRows = (analyticsData.closedPositions || []).map(pos => [
        pos.ticker,
        pos.type,
        pos.totalTrades,
        pos.totalGainLoss.toFixed(2),
        pos.avgGainPerTrade.toFixed(2),
        pos.roi.toFixed(2),
        pos.winRate.toFixed(2),
        pos.winningTrades,
        pos.losingTrades,
        pos.avgHoldingDays,
      ]);

      const closedCSV = generateCSV(closedHeaders, closedRows);

      // Generar CSV de métricas globales
      const metricsData = analyticsData.metrics || {};
      const metricsHeaders = ['Métrica', 'Valor'];
      const metricsRows = [
        ['Total Trades', metricsData.totalTrades],
        ['Ganancias Totales USD', metricsData.totalGainLoss?.toFixed(2)],
        ['Ganancias Totales EUR', metricsData.totalGainLossEur?.toFixed(2)],
        ['ROI Global %', metricsData.globalROI?.toFixed(2)],
        ['Win Rate %', metricsData.winRate?.toFixed(2)],
        ['Ganancia Media por Trade USD', metricsData.avgGainPerTrade?.toFixed(2)],
        ['Ganancia Media por Trade EUR', metricsData.avgGainPerTradeEur?.toFixed(2)],
        ['Trades Ganadores', metricsData.winningTrades],
        ['Trades Perdedores', metricsData.losingTrades],
        ['Tiempo Promedio Posesión (días)', metricsData.avgHoldingDays],
      ];

      const metricsCSV = generateCSV(metricsHeaders, metricsRows);

      // Combinar todos los CSV
      const allContent = [
        '=== TRANSACCIONES ===',
        transactionCSV,
        '\n\n=== POSICIONES CERRADAS ===',
        closedCSV,
        '\n\n=== ESTADÍSTICAS GLOBALES ===',
        metricsCSV,
      ].join('\n');

      const now = new Date();
      const filename = `inversiones-export-${now.toISOString().split('T')[0]}.csv`;

      downloadFile(allContent, filename);
      setSuccess('Datos exportados exitosamente.');

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setExportError(err.message || 'Error al exportar datos');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Configuración</h2>
        <p className="text-zinc-400 mb-6">
          Personaliza tu experiencia y preferencias.
        </p>

        <div className="bg-zinc-800/50 rounded-lg p-6 border border-zinc-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Cambiar contraseña</h3>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm text-zinc-300 mb-2">Contraseña actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-zinc-900/70 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-2">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-zinc-900/70 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-2">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-900/70 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </div>

        <div className="mt-8 bg-zinc-800/50 rounded-lg p-6 border border-zinc-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Exportar datos</h3>
          <p className="text-zinc-400 text-sm mb-6">
            Descarga un archivo CSV con todas tus transacciones, posiciones cerradas y estadísticas de inversión.
          </p>

          {exportError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {exportError}
            </div>
          )}

          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="btn-secondary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className={`w-5 h-5 ${isExporting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isExporting ? 'Exportando...' : 'Descargar CSV'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
