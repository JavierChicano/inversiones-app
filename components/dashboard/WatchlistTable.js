'use client';

import { useState, useEffect, useRef } from 'react';
import { TargetIcon } from '@/components/icons';

export default function WatchlistTable({ watchlist, onDelete, onEdit }) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ targetPrice: '', notes: '' });
  const [openMenuId, setOpenMenuId] = useState(null);
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

  const handleEditStart = (item) => {
    setEditingId(item.id);
    setEditData({
      targetPrice: item.targetPrice || '',
      notes: item.notes || '',
    });
  };

  const handleEditSave = async (id) => {
    await onEdit(id, {
      targetPrice: editData.targetPrice ? parseFloat(editData.targetPrice) : null,
      notes: editData.notes || null,
    });
    setEditingId(null);
    setOpenMenuId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditData({ targetPrice: '', notes: '' });
    setOpenMenuId(null);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '-';
    const color = value >= 0 ? 'text-green-500' : 'text-red-500';
    return (
      <span className={color}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    );
  };

  return (
    <>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-center text-sm font-medium text-zinc-400 pb-3 px-4">Ticker</th>
            <th className="text-center text-sm font-medium text-zinc-400 pb-3 px-4">Tipo</th>
            <th className="text-center text-sm font-medium text-zinc-400 pb-3 px-4">Precio Actual</th>
            <th className="text-center text-sm font-medium text-zinc-400 pb-3 px-4">Precio Objetivo</th>
            <th className="text-center text-sm font-medium text-zinc-400 pb-3 px-4">% vs Objetivo</th>
            <th className="text-center text-sm font-medium text-zinc-400 pb-3 px-4">Notas</th>
            <th className="text-center text-sm font-medium text-zinc-400 pb-3 px-4">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {watchlist.length === 0 ? (
            <tr>
              <td colSpan="7" className="text-center py-12 text-zinc-500">
                No tienes activos en tu watchlist. Añade algunos para empezar a seguirlos.
              </td>
            </tr>
          ) : (
            watchlist.map((item) => (
              <tr key={item.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-4 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-semibold text-white">{item.assetTicker}</span>
                    {item.targetReached && (
                      <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                        <TargetIcon className="w-3 h-3" />
                        Objetivo
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-zinc-500">{item.name}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className={`text-xs px-2 py-1 rounded ${
                    item.type === 'CRYPTO' 
                      ? 'bg-orange-500/20 text-orange-400' 
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {item.type}
                  </span>
                </td>
                <td className="py-4 px-4 text-center text-white font-semibold">
                  {formatCurrency(item.currentPrice)}
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-zinc-300">
                    {item.targetPrice ? formatCurrency(item.targetPrice) : '-'}
                  </span>
                </td>
                <td className="py-4 px-4 text-center font-semibold">
                  {formatPercentage(item.priceVsTarget)}
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-sm text-zinc-400 truncate block max-w-50 mx-auto">
                    {item.notes || '-'}
                  </span>
                </td>
                <td className="py-4 px-4 text-center relative">
                  <div ref={openMenuId === item.id ? menuRef : null}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                      className="text-zinc-400 hover:text-white transition-colors p-1"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>

                    {openMenuId === item.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10">
                        <button
                          onClick={() => {
                            handleEditStart(item);
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
                            onDelete(item.id);
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
            ))
          )}
        </tbody>
      </table>

      {/* Modal de edición inline */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Editar Watchlist</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Precio Objetivo
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editData.targetPrice}
                  onChange={(e) => setEditData({ ...editData, targetPrice: e.target.value })}
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Notas
                </label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Añadir notas..."
                  rows="3"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEditCancel}
                className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEditSave(editingId)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
