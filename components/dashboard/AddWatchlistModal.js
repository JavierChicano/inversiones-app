'use client';

import { useState, useEffect } from 'react';
import { CloseIcon, PlusIcon } from '@/components/icons';

export default function AddWatchlistModal({ isOpen, onClose, onAdd, existingAssets }) {
  const [ticker, setTicker] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ticker || ticker.length < 2) {
      setSuggestions([]);
      return;
    }

    // Filtrar assets existentes que coincidan con el ticker
    const filtered = existingAssets
      .filter(asset => 
        asset.ticker.toLowerCase().includes(ticker.toLowerCase()) ||
        asset.name?.toLowerCase().includes(ticker.toLowerCase())
      )
      .slice(0, 5);

    setSuggestions(filtered);
  }, [ticker, existingAssets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    setIsLoading(true);
    try {
      await onAdd({
        assetTicker: ticker.toUpperCase().trim(),
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        notes: notes.trim() || null,
      });
      
      // Reset form
      setTicker('');
      setTargetPrice('');
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (asset) => {
    setTicker(asset.ticker);
    setSuggestions([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-4">Añadir a Watchlist</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Ticker <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              placeholder="AAPL, BTC, etc."
              required
            />
            
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {suggestions.map((asset) => (
                  <button
                    key={asset.ticker}
                    type="button"
                    onClick={() => handleSuggestionClick(asset)}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-semibold">{asset.ticker}</span>
                        <span className="text-xs text-zinc-500 ml-2">{asset.name}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        asset.type === 'CRYPTO' 
                          ? 'bg-orange-500/20 text-orange-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {asset.type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Precio Objetivo (opcional)
            </label>
            <input
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              placeholder="0.00"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Te avisaremos cuando el precio alcance tu objetivo
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="¿Por qué te interesa este activo?"
              rows="3"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !ticker.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                'Añadiendo...'
              ) : (
                <>
                  <PlusIcon className="w-4 h-4" />
                  Añadir
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
