'use client';

import { useState, useEffect, useRef } from 'react';

export default function TransactionsTable({ data, onTransactionUpdated }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [sellModalData, setSellModalData] = useState(null);
  const [editModalData, setEditModalData] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const menuRef = useRef(null);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Historial de Transacciones</h3>
        <p className="text-zinc-400 text-center py-8">
          No hay transacciones registradas
        </p>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAssetColor = (type) => {
    if (type === 'CRYPTO') return 'bg-yellow-600';
    if (type === 'FIAT') return 'bg-green-500';
    return 'bg-blue-500';
  };
  
  const getAssetTypeLabel = (type) => {
    if (type === 'CRYPTO') return 'Crypto';
    if (type === 'FIAT') return 'Forex';
    return 'Stock';
  };

  const getTransactionTypeStyle = (type) => {
    if (type === 'BUY') {
      return {
        bgClass: 'bg-green-500/10',
        textClass: 'text-green-500',
        label: 'Compra'
      };
    }
    return {
      bgClass: 'bg-red-500/10',
      textClass: 'text-red-500',
      label: 'Venta'
    };
  };

  // Ordenar por fecha de más reciente a más antiguo
  const sortedData = [...data].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );

  // Calcular totales
  const totalBuyAmount = sortedData
    .filter(tx => tx.type === 'BUY')
    .reduce((sum, tx) => sum + (tx.quantity * tx.pricePerUnit + (tx.fees || 0)), 0);
  
  const totalSellAmount = sortedData
    .filter(tx => tx.type === 'SELL')
    .reduce((sum, tx) => sum + (tx.quantity * tx.pricePerUnit - (tx.fees || 0)), 0);

  const handleDelete = async (transactionId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setDeleteConfirm(null);
        if (onTransactionUpdated) onTransactionUpdated();
      } else {
        console.error('Error deleting transaction');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-lg font-semibold">Historial de Transacciones</h3>
          <div className="flex gap-4 text-sm">
            <div className="text-zinc-400">
              Total Compras: <span className="text-green-500 font-semibold">{formatCurrency(totalBuyAmount)}</span>
            </div>
            <div className="text-zinc-400">
              Total Ventas: <span className="text-red-500 font-semibold">{formatCurrency(totalSellAmount)}</span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Fecha</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Ticker</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Tipo Asset</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Operación</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Inversión USD</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Cantidad</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Precio/Unidad</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Comisiones</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Total USD</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium text-sm">Editar</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((transaction, index) => {
                const txType = getTransactionTypeStyle(transaction.type);
                const totalAmount = transaction.quantity * transaction.pricePerUnit;
                const totalWithFees = transaction.type === 'BUY' 
                  ? totalAmount + (transaction.fees || 0)
                  : totalAmount - (transaction.fees || 0);

                return (
                  <tr
                    key={transaction.id || index}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-4 px-4 text-center text-zinc-300 text-sm">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getAssetColor(transaction.asset?.type)}`}></div>
                        <span className="text-white font-semibold">{transaction.assetTicker}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-zinc-400 text-sm">
                      {getAssetTypeLabel(transaction.asset?.type || 'STOCK')}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold ${txType.bgClass} ${txType.textClass}`}>
                        {txType.label}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-white font-semibold">
                      {formatCurrency(totalWithFees)}
                    </td>
                    <td className="py-4 px-4 text-center text-zinc-300">
                      {transaction.quantity.toLocaleString('es-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8,
                      })}
                    </td>
                    <td className="py-4 px-4 text-center text-zinc-300">
                      {formatCurrency(transaction.pricePerUnit)}
                    </td>
                    <td className="py-4 px-4 text-center text-zinc-400 text-sm">
                      {transaction.fees ? formatCurrency(transaction.fees) : '-'}
                    </td>
                    <td className={`py-4 px-4 text-center font-semibold ${
                      transaction.type === 'BUY' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {transaction.type === 'BUY' ? '-' : '+'}{formatCurrency(totalWithFees)}
                    </td>
                    <td className="py-4 px-4 text-center relative">
                      <div ref={openMenuId === transaction.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === transaction.id ? null : transaction.id)}
                          className="text-zinc-400 hover:text-white transition-colors p-1"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {openMenuId === transaction.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10">
                            {transaction.type === 'BUY' && (
                              <button
                                onClick={() => {
                                  setSellModalData(transaction);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-700 transition-colors flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Vender
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditModalData(transaction);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-700 transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm(transaction);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Borrar
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700">
                <td colSpan="8" className="py-4 px-8 text-white font-bold text-right">
                  Balance Neto:
                </td>
                <td className={`py-4 px-4 text-center font-bold text-lg ${
                  (totalSellAmount - totalBuyAmount) >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}>
                  {formatCurrency(totalSellAmount - totalBuyAmount)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modales */}
      <SellModal 
        transaction={sellModalData} 
        onClose={() => setSellModalData(null)}
        onSuccess={() => {
          setSellModalData(null);
          if (onTransactionUpdated) onTransactionUpdated();
        }}
      />

      <EditModal 
        transaction={editModalData}
        onClose={() => setEditModalData(null)}
        onSuccess={() => {
          setEditModalData(null);
          if (onTransactionUpdated) onTransactionUpdated();
        }}
      />

      <DeleteConfirmModal
        transaction={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm.id)}
      />
    </>
  );
}

// Modal para vender
function SellModal({ transaction, onClose, onSuccess }) {
  const [sellType, setSellType] = useState('total');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [fees, setFees] = useState('0');
  const [loading, setLoading] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // Obtener precio actual del asset cuando se abre el modal
  useEffect(() => {
    if (transaction) {
      const fetchCurrentPrice = async () => {
        setLoadingPrice(true);
        try {
          const token = localStorage.getItem('auth_token');
          const response = await fetch(`/api/assets/${transaction.assetTicker}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.currentPrice) {
              setPricePerUnit(data.currentPrice.toString());
            }
          }
        } catch (error) {
          console.error('Error fetching current price:', error);
        } finally {
          setLoadingPrice(false);
        }
      };

      fetchCurrentPrice();
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const sellQuantity = sellType === 'total' ? transaction.quantity : parseFloat(quantity);

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticker: transaction.assetTicker,
          type: 'SELL',
          assetType: transaction.asset?.type || 'STOCK',
          quantity: sellQuantity,
          pricePerUnit: parseFloat(pricePerUnit),
          fees: parseFloat(fees),
          date: date,
        }),
      });

      if (response.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-4">Vender {transaction.assetTicker}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Tipo de Venta</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="total"
                  checked={sellType === 'total'}
                  onChange={(e) => setSellType(e.target.value)}
                  className="text-primary"
                />
                <span className="text-white">Total ({transaction.quantity})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="partial"
                  checked={sellType === 'partial'}
                  onChange={(e) => setSellType(e.target.value)}
                  className="text-primary"
                />
                <span className="text-white">Parcial</span>
              </label>
            </div>
          </div>

          {sellType === 'partial' && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Cantidad</label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                max={transaction.quantity}
                required
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">Máximo: {transaction.quantity}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Precio por Unidad (Actual)
              {loadingPrice && <span className="text-xs text-zinc-500 ml-2">Cargando precio...</span>}
            </label>
            <input
              type="number"
              step="any"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              required
              disabled={loadingPrice}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50"
              placeholder="Precio actual de venta"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Precio de compra original: ${transaction.pricePerUnit.toFixed(2)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Comisiones</label>
            <input
              type="number"
              step="any"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Vendiendo...' : 'Vender'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para editar
function EditModal({ transaction, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    type: '',
    quantity: '',
    pricePerUnit: '',
    fees: '',
    date: '',
  });
  const [loading, setLoading] = useState(false);

  // Inicializar form data cuando cambia la transacción
  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type,
        quantity: transaction.quantity.toString(),
        pricePerUnit: transaction.pricePerUnit.toString(),
        fees: (transaction.fees || 0).toString(),
        date: new Date(transaction.date).toISOString().split('T')[0],
      });
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: formData.type,
          quantity: parseFloat(formData.quantity),
          pricePerUnit: parseFloat(formData.pricePerUnit),
          fees: parseFloat(formData.fees),
          date: formData.date,
        }),
      });

      if (response.ok) {
        // Resetear formulario antes de cerrar
        setFormData({
          type: '',
          quantity: '',
          pricePerUnit: '',
          fees: '',
          date: '',
        });
        onSuccess();
      } else {
        console.error('Error updating transaction');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-4">Editar Transacción</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Tipo</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            >
              <option value="BUY">Compra</option>
              <option value="SELL">Venta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Cantidad</label>
            <input
              type="number"
              step="any"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Precio por Unidad</label>
            <input
              type="number"
              step="any"
              value={formData.pricePerUnit}
              onChange={(e) => setFormData(prev => ({ ...prev, pricePerUnit: e.target.value }))}
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Comisiones</label>
            <input
              type="number"
              step="any"
              value={formData.fees}
              onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Fecha</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de confirmación de borrado
function DeleteConfirmModal({ transaction, onClose, onConfirm }) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-4">Confirmar Eliminación</h3>
        <p className="text-zinc-300 mb-6">
          ¿Estás seguro de que deseas eliminar esta transacción de <span className="font-semibold text-white">{transaction.assetTicker}</span>?
        </p>
        <p className="text-zinc-500 text-sm mb-6">Esta acción no se puede deshacer.</p>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
