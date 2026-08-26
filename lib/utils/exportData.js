/**
 * Exportación de datos del usuario a CSV (transacciones, posiciones cerradas y métricas).
 */

function generateCSV(headers, rows) {
  return [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell ?? '');
          return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
            ? `"${cellStr.replace(/"/g, '""')}"`
            : cellStr;
        })
        .join(',')
    ),
  ].join('\n');
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Descarga un CSV con todas las transacciones, posiciones cerradas y estadísticas del usuario.
 * @param {string} token - JWT del usuario
 * @returns {Promise<string>} Nombre del archivo descargado
 */
export async function exportUserDataToCSV(token) {
  if (!token) {
    throw new Error('No autorizado');
  }

  const headers = { Authorization: `Bearer ${token}` };

  const transactionsResponse = await fetch('/api/transactions', { headers });
  if (!transactionsResponse.ok) {
    throw new Error('Error al obtener transacciones');
  }
  const transactions = (await transactionsResponse.json()).transactions || [];

  const analyticsResponse = await fetch('/api/analytics/closed-positions', { headers });
  if (!analyticsResponse.ok) {
    throw new Error('Error al obtener análisis');
  }
  const analyticsData = await analyticsResponse.json();

  const transactionHeaders = ['Fecha', 'Ticker', 'Tipo Asset', 'Operación', 'Cantidad', 'Precio/Unidad', 'Comisiones', 'Total USD'];
  const transactionRows = transactions.map((tx) => [
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

  const closedHeaders = ['Ticker', 'Tipo', 'Operaciones', 'Invertido EUR', 'Total vendido EUR', 'Ganancia Total', 'Ganancia Media', 'ROI %', 'Win Rate %', 'Trades Ganadores', 'Trades Perdedores', 'Tiempo Promedio (días)'];
  const closedRows = (analyticsData.closedPositions || []).map((pos) => [
    pos.ticker,
    pos.type,
    pos.totalTrades,
    (pos.totalInvested || 0).toFixed(2),
    (pos.totalRevenue || 0).toFixed(2),
    pos.totalGainLoss.toFixed(2),
    pos.avgGainPerTrade.toFixed(2),
    pos.roi.toFixed(2),
    pos.winRate.toFixed(2),
    pos.winningTrades,
    pos.losingTrades,
    pos.avgHoldingDays,
  ]);

  const metricsData = analyticsData.metrics || {};
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

  const allContent = [
    '=== TRANSACCIONES ===',
    generateCSV(transactionHeaders, transactionRows),
    '\n\n=== POSICIONES CERRADAS ===',
    generateCSV(closedHeaders, closedRows),
    '\n\n=== ESTADÍSTICAS GLOBALES ===',
    generateCSV(['Métrica', 'Valor'], metricsRows),
  ].join('\n');

  const filename = `inversiones-export-${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(allContent, filename);

  return filename;
}
