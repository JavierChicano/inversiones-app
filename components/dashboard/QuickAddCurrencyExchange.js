'use client';

import { useState } from 'react';
import { PlusIcon, CloseIcon } from '../icons';

export default function QuickAddCurrencyExchange({ onExchangeAdded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    fromCurrency: 'EUR',
    toCurrency: 'USD',
    amount: '',
    exchangeRate: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/currency-exchanges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsOpen(false);
        setFormData({
          fromCurrency: 'EUR',
          toCurrency: 'USD',
          amount: '',
          exchangeRate: '',
          date: new Date().toISOString().split('T')[0],
        });
        if (onExchangeAdded) {
          onExchangeAdded();
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Error al agregar cambio de divisa');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al agregar cambio de divisa');
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
      // Obtener el tipo de cambio desde la API que usa la tabla assets
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
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary hover:bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50 cursor-pointer"
        title="Agregar Cambio de Divisa"
      >
        <PlusIcon className="w-6 h-6" />
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Nuevo Cambio de Divisa</h2>
              <button
                onClick={() => setIsOpen(false)}
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
                  onClick={() => setIsOpen(false)}
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
      )}
    </>
  );
}
