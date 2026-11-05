/**
 * Exportación de datos del usuario a CSV (transacciones, posiciones cerradas, posiciones apalancadas y métricas).
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
 * Descarga un CSV con todas las transacciones, posiciones cerradas, posiciones apalancadas y estadísticas del usuario.
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

  const leverageResponse = await fetch('/api/leverage', { headers });
  if (!leverageResponse.ok) {
    throw new Error('Error al obtener posiciones apalancadas');
  }
  const leverageData = await leverageResponse.json();

  const leverageHeaders = ['Estado', 'Apertura', 'Cierre', 'Ticker', 'Dirección', 'Garantía USD', 'Multiplicador', 'Exposición USD', 'Precio Entrada', 'Precio Cierre/Actual', 'Cantidad', 'Días', 'Comisiones USD', 'P&L Bruto USD', 'P&L Neto USD', 'ROI %', 'Motivo Cierre'];
  const leverageRows = [...(leverageData.openPositions || []), ...(leverageData.closedPositions || [])].map((pos) => {
    const isOpen = pos.status === 'OPEN';
    const evaluation = pos.evaluation || {};
    return [
      isOpen ? 'Abierta' : 'Cerrada',
      new Date(pos.openedAt).toLocaleString('es-ES'),
      pos.closedAt ? new Date(pos.closedAt).toLocaleString('es-ES') : '',
      pos.assetTicker,
      pos.direction === 'SHORT' ? 'Corto' : 'Largo',
      (pos.margin || 0).toFixed(2),
      pos.leverage,
      (pos.exposure || 0).toFixed(2),
      (pos.entryPrice || 0).toFixed(4),
      (isOpen ? evaluation.currentPrice || 0 : pos.closePrice || 0).toFixed(4),
      (pos.quantity || 0).toFixed(8),
      isOpen ? evaluation.daysHeld || 0 : pos.daysHeld || 0,
      (isOpen ? evaluation.feesAccrued || 0 : pos.totalFees || 0).toFixed(2),
      (isOpen ? evaluation.grossPnl || 0 : pos.grossPnl || 0).toFixed(2),
      (isOpen ? evaluation.netPnl || 0 : pos.netPnl || 0).toFixed(2),
      (isOpen ? evaluation.roi || 0 : pos.roi || 0).toFixed(2),
      isOpen ? '' : pos.closeReason || '',
    ];
  });

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
    '\n\n=== POSICIONES APALANCADAS (CFD) ===',
    generateCSV(leverageHeaders, leverageRows),
    '\n\n=== ESTADÍSTICAS GLOBALES ===',
    generateCSV(['Métrica', 'Valor'], metricsRows),
  ].join('\n');

  const filename = `inversiones-export-${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(allContent, filename);

  return filename;
}
