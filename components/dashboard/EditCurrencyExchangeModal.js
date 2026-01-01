'use client';

import { useState, useEffect } from 'react';
import { CloseIcon } from '../icons';

export default function EditCurrencyExchangeModal({ exchange, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    fromCurrency: '',
    toCurrency: '',
    amount: '',
    exchangeRate: '',
    date: '',
  });
  const [loading, setLoading] = useState(false);

  // Inicializar form data cuando cambia el exchange
  useEffect(() => {
    if (exchange) {
      setFormData({
        fromCurrency: exchange.fromCurrency,
        toCurrency: exchange.toCurrency,
        amount: exchange.amount.toString(),
        exchangeRate: exchange.exchangeRate.toString(),
        date: new Date(exchange.date).toISOString().split('T')[0],
      });
    }
  }, [exchange]);

  if (!exchange) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/currency-exchanges/${exchange.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromCurrency: formData.fromCurrency,
          toCurrency: formData.toCurrency,
          amount: parseFloat(formData.amount),
          exchangeRate: parseFloat(formData.exchangeRate),
          date: formData.date,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Error al actualizar cambio de divisa');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar cambio de divisa');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCurrencySwitch = () => {
    setFormData((prev) => ({
      ...prev,
      fromCurrency: prev.toCurrency,
      toCurrency: prev.fromCurrency,
      exchangeRate: prev.exchangeRate ? (1 / parseFloat(prev.exchangeRate)).toFixed(4) : '',
    }));
  };

  const loadCurrentRate = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/currency-exchanges', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const rate = formData.fromCurrency === 'EUR' 
          ? data.currentRate.eurToUsd 
          : data.currentRate.usdToEur;
        
        setFormData((prev) => ({
          ...prev,
          exchangeRate: rate.toFixed(4),
        }));
      } else {
        alert('Error al obtener tipo de cambio actual');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al obtener tipo de cambio actual');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Editar Cambio de Divisa</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector de divisas */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-zinc-400 text-sm mb-2">De</label>
              <select
                name="fromCurrency"
                value={formData.fromCurrency}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white focus:border-primary focus:outline-none"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleCurrencySwitch}
              className="mt-6 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              ⇄
            </button>
            <div className="flex-1">
              <label className="block text-zinc-400 text-sm mb-2">A</label>
              <select
                name="toCurrency"
                value={formData.toCurrency}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white focus:border-primary focus:outline-none"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-zinc-400 text-sm mb-2">
              Cantidad ({formData.fromCurrency})
            </label>
            <input
              type="number"
              name="amount"
              step="0.01"
              value={formData.amount}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white focus:border-primary focus:outline-none"
              required
            />
          </div>

          {/* Tipo de cambio */}
          <div>
            <label className="block text-zinc-400 text-sm mb-2">
              Tipo de Cambio
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="exchangeRate"
                step="0.0001"
                value={formData.exchangeRate}
                onChange={handleChange}
                className="flex-1 px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white focus:border-primary focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={loadCurrentRate}
                className="px-3 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg transition-colors"
              >
                Actual
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Tipo de cambio al momento de la operación
            </p>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Fecha</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white focus:border-primary focus:outline-none"
              required
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
