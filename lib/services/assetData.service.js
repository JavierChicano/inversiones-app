// Servicio para obtener datos de assets desde APIs externas
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '';
const COINGECKO_API_URL = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

/**
 * Obtener datos de una acción desde Twelve Data
 * @param {string} ticker - Símbolo de la acción
 * @returns {Promise<Object>} Datos de la acción
 */
async function fetchStockData(ticker) {
  try {
    // Twelve Data API para acciones
    const url = `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${TWELVE_DATA_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'error' || !data.name) {
      throw new Error(data.message || 'Error al obtener datos de la acción');
    }

    return {
      name: data.name,
      currentPrice: parseFloat(data.close) || 0,
    };
  } catch (error) {
    console.error(`Error fetching stock data for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Obtener datos de una criptomoneda desde CoinGecko
 * @param {string} ticker - Símbolo de la criptomoneda (ej: BTC, ETH)
 * @returns {Promise<Object>} Datos de la criptomoneda
 */
async function fetchCryptoData(ticker) {
  try {
    // Mapeo de tickers comunes a IDs de CoinGecko
    const cryptoIdMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'XRP': 'ripple',
      'USDC': 'usd-coin',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'TRX': 'tron',
      'TON': 'the-open-network',
      'LINK': 'chainlink',
      'AVAX': 'avalanche-2',
      'DOT': 'polkadot',
      'MATIC': 'matic-network',
    };

    const cryptoId = cryptoIdMap[ticker.toUpperCase()] || ticker.toLowerCase();
    
    // CoinGecko API para criptomonedas
    const url = `${COINGECKO_API_URL}/coins/${cryptoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      name: data.name,
      currentPrice: data.market_data?.current_price?.usd || 0,
    };
  } catch (error) {
    console.error(`Error fetching crypto data for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Obtener tasa de cambio para un par de divisas
 * @param {string} ticker - Par de divisas (ej: EUR/USD, EURUSD)
 * @returns {Promise<Object>} Datos de la tasa de cambio
 */
async function fetchForexData(ticker) {
  try {
    // Normalizar el ticker (EUR/USD o EURUSD -> EURUSD)
    const normalizedTicker = ticker.replace('/', '').toUpperCase();
    
    // Extraer monedas base y cotización
    // Asumimos formato de 6 caracteres: EURUSD
    const baseCurrency = normalizedTicker.substring(0, 3); // EUR
    const quoteCurrency = normalizedTicker.substring(3, 6); // USD
    
    // Usar Twelve Data para obtener tasa de cambio con mejor precisión
    const forexPair = `${baseCurrency}/${quoteCurrency}`;
    const url = `https://api.twelvedata.com/quote?symbol=${forexPair}&apikey=${TWELVE_DATA_API_KEY}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Twelve Data API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status === 'error' || !data.close) {
      throw new Error(data.message || `No se encontró tasa para ${forexPair}`);
    }

    // Obtener el precio de cierre con precisión completa
    const preciseRate = parseFloat(data.close);

    return {
      name: forexPair,
      currentPrice: preciseRate,
    };
  } catch (error) {
    console.error(`Error fetching forex data for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Obtener datos de un asset según su tipo
 * @param {string} ticker - Símbolo del asset
 * @param {string} type - Tipo del asset (STOCK, CRYPTO o FIAT)
 * @returns {Promise<Object>} Datos del asset
 */
export async function fetchAssetData(ticker, type) {
  try {
    if (type === 'CRYPTO') {
      return await fetchCryptoData(ticker);
    } else if (type === 'STOCK') {
      return await fetchStockData(ticker);
    } else if (type === 'FIAT') {
      return await fetchForexData(ticker);
    } else {
      throw new Error(`Tipo de asset no soportado: ${type}`);
    }
  } catch (error) {
    console.error(`Error fetching asset data for ${ticker} (${type}):`, error);
    // Devolver datos por defecto en caso de error
    return {
      name: ticker,
      currentPrice: 0,
    };
  }
}
