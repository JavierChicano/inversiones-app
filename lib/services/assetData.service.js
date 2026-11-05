/**
 * Servicio para obtener datos de assets desde APIs externas.
 *
 *  - Acciones y forex: Twelve Data (requiere TWELVE_DATA_API_KEY; plan gratuito 8 req/min, 800/día)
 *  - Criptomonedas: CoinGecko (sin clave; /simple/price permite consultar muchas monedas en una llamada)
 *
 * Todas las llamadas tienen timeout para que un proveedor colgado no bloquee el cron ni la función serverless.
 */

const TWELVE_DATA_API_URL = 'https://api.twelvedata.com';

export const FETCH_TIMEOUT_MS = 10_000;
export const STOCK_BATCH_SIZE = 8;
export const CRYPTO_BATCH_SIZE = 50;

/** Mapeo de tickers comunes a IDs de CoinGecko */
export const CRYPTO_ID_MAP = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  TON: 'the-open-network',
  LINK: 'chainlink',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
  UNI: 'uniswap',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  ATOM: 'cosmos',
  NEAR: 'near',
  SUI: 'sui',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  XLM: 'stellar',
  HBAR: 'hedera-hashgraph',
  ALGO: 'algorand',
  VET: 'vechain',
  FIL: 'filecoin',
  ICP: 'internet-computer',
  INJ: 'injective-protocol',
  TIA: 'celestia',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  KAS: 'kaspa',
  RENDER: 'render-token',
  AAVE: 'aave',
  ETC: 'ethereum-classic',
  XMR: 'monero',
};

export function getCoinGeckoApiUrl() {
  return process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
}

export function getTwelveDataApiKey() {
  return process.env.TWELVE_DATA_API_KEY || '';
}

/** @param {string} ticker @returns {string} id de CoinGecko */
export function getCoinGeckoId(ticker) {
  const upper = String(ticker || '').toUpperCase();
  return CRYPTO_ID_MAP[upper] || String(ticker || '').toLowerCase();
}

/** Convierte un valor de precio a número positivo; null si no es válido */
export function parsePrice(value) {
  const price = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function fetchJson(url, { headers = {}, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function twelveDataUrl(path, params) {
  const search = new URLSearchParams({ ...params, apikey: getTwelveDataApiKey() });
  return `${TWELVE_DATA_API_URL}${path}?${search.toString()}`;
}

/**
 * Datos de una acción desde Twelve Data (nombre y último cierre)
 * @param {string} ticker
 * @returns {Promise<{name:string,currentPrice:number}>}
 */
export async function fetchStockData(ticker) {
  const data = await fetchJson(twelveDataUrl('/quote', { symbol: ticker }));

  if (data.status === 'error' || !data.name) {
    throw new Error(data.message || `Twelve Data no devolvió datos para ${ticker}`);
  }

  return {
    name: data.name,
    currentPrice: parsePrice(data.close) || 0,
  };
}

/**
 * Datos de una criptomoneda desde CoinGecko (nombre y precio en USD)
 * @param {string} ticker
 * @returns {Promise<{name:string,currentPrice:number}>}
 */
export async function fetchCryptoData(ticker) {
  const id = getCoinGeckoId(ticker);
  const url = `${getCoinGeckoApiUrl()}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
  const data = await fetchJson(url);

  return {
    name: data.name,
    currentPrice: parsePrice(data.market_data?.current_price?.usd) || 0,
  };
}

/**
 * Tasa de cambio de un par de divisas (EUR/USD o EURUSD) desde Twelve Data
 * @param {string} ticker
 * @returns {Promise<{name:string,currentPrice:number}>}
 */
export async function fetchForexData(ticker) {
  const normalized = String(ticker).replace('/', '').toUpperCase();
  const pair = `${normalized.substring(0, 3)}/${normalized.substring(3, 6)}`;
  const data = await fetchJson(twelveDataUrl('/quote', { symbol: pair }));

  if (data.status === 'error' || !data.close) {
    throw new Error(data.message || `No se encontró tasa para ${pair}`);
  }

  const price = parsePrice(data.close);
  if (!price) {
    throw new Error(`Tasa inválida para ${pair}`);
  }

  return { name: pair, currentPrice: price };
}

/**
 * Precios de varias acciones en una sola llamada a Twelve Data.
 * @param {string[]} tickers - como máximo STOCK_BATCH_SIZE
 * @returns {Promise<Map<string, number>>} ticker → precio (solo los que tienen precio válido)
 */
export async function fetchStockPrices(tickers) {
  const prices = new Map();
  if (tickers.length === 0) return prices;

  const data = await fetchJson(twelveDataUrl('/price', { symbol: tickers.join(',') }));

  if (data.status === 'error') {
    throw new Error(data.message || 'Twelve Data devolvió un error');
  }

  if (tickers.length === 1) {
    const price = parsePrice(data.price);
    if (price) prices.set(tickers[0], price);
    return prices;
  }

  for (const ticker of tickers) {
    const price = parsePrice(data[ticker]?.price);
    if (price) prices.set(ticker, price);
  }

  return prices;
}

/**
 * Precios de varias criptomonedas en una sola llamada a CoinGecko (/simple/price).
 * @param {string[]} tickers
 * @returns {Promise<Map<string, number>>} ticker → precio USD (solo los encontrados)
 */
export async function fetchCryptoPrices(tickers) {
  const prices = new Map();
  if (tickers.length === 0) return prices;

  const tickersById = new Map();
  for (const ticker of tickers) {
    const id = getCoinGeckoId(ticker);
    if (!tickersById.has(id)) tickersById.set(id, []);
    tickersById.get(id).push(ticker);
  }

  const ids = [...tickersById.keys()].map(encodeURIComponent).join(',');
  const data = await fetchJson(`${getCoinGeckoApiUrl()}/simple/price?ids=${ids}&vs_currencies=usd`);

  for (const [id, idTickers] of tickersById) {
    const price = parsePrice(data?.[id]?.usd);
    if (!price) continue;
    for (const ticker of idTickers) prices.set(ticker, price);
  }

  return prices;
}

/**
 * Obtener datos de un asset según su tipo. Nunca lanza: si la API falla devuelve
 * `{ name: ticker, currentPrice: 0 }` para que el alta del asset no bloquee al usuario.
 * @param {string} ticker
 * @param {'STOCK'|'CRYPTO'|'INDEX'|'FIAT'} type
 */
export async function fetchAssetData(ticker, type) {
  try {
    if (type === 'CRYPTO') return await fetchCryptoData(ticker);
    if (type === 'STOCK' || type === 'INDEX') return await fetchStockData(ticker);
    if (type === 'FIAT') return await fetchForexData(ticker);
    throw new Error(`Tipo de asset no soportado: ${type}`);
  } catch (error) {
    console.error(`Error fetching asset data for ${ticker} (${type}):`, error?.message || error);
    return { name: ticker, currentPrice: 0 };
  }
}

/**
 * Precio actual de un asset. Lanza si no se obtiene un precio válido (> 0).
 * @param {string} ticker
 * @param {'STOCK'|'CRYPTO'|'INDEX'|'FIAT'} type
 * @returns {Promise<number>}
 */
export async function fetchAssetPrice(ticker, type) {
  let data;
  if (type === 'CRYPTO') data = await fetchCryptoData(ticker);
  else if (type === 'STOCK' || type === 'INDEX') data = await fetchStockData(ticker);
  else if (type === 'FIAT') data = await fetchForexData(ticker);
  else throw new Error(`Tipo de asset no soportado: ${type}`);

  const price = parsePrice(data.currentPrice);
  if (!price) {
    throw new Error(`Precio no disponible para ${ticker}`);
  }

  return price;
}
