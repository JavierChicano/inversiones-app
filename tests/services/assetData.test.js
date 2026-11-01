import { afterEach, describe, expect, test } from 'bun:test';
import {
  CRYPTO_ID_MAP,
  chunkArray,
  fetchAssetData,
  fetchAssetPrice,
  fetchCryptoData,
  fetchCryptoPrices,
  fetchForexData,
  fetchStockData,
  fetchStockPrices,
  getCoinGeckoId,
  parsePrice,
} from '@/lib/services/assetData.service';
import { installFetchMock } from '../helpers/fetchMock.js';

let fetchMock;
afterEach(() => fetchMock?.restore());

describe('helpers', () => {
  test('getCoinGeckoId usa el mapa y cae a minúsculas', () => {
    expect(getCoinGeckoId('btc')).toBe('bitcoin');
    expect(getCoinGeckoId('POL')).toBe(CRYPTO_ID_MAP.POL);
    expect(getCoinGeckoId('NEWCOIN')).toBe('newcoin');
  });

  test('parsePrice solo acepta positivos finitos', () => {
    expect(parsePrice('150.5')).toBe(150.5);
    expect(parsePrice(0)).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice(-1)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });

  test('chunkArray', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkArray([], 2)).toEqual([]);
  });
});

describe('Twelve Data', () => {
  test('fetchStockData devuelve nombre y cierre', async () => {
    fetchMock = installFetchMock([{ match: /\/quote\?symbol=AAPL/, response: { name: 'Apple', close: '150.25' } }]);
    expect(await fetchStockData('AAPL')).toEqual({ name: 'Apple', currentPrice: 150.25 });
    expect(fetchMock.calls[0].url).toContain('apikey=test-twelve-data-key');
  });

  test('fetchStockData lanza con respuestas de error', async () => {
    fetchMock = installFetchMock([{ match: /\/quote/, response: { status: 'error', message: 'symbol not found' } }]);
    await expect(fetchStockData('XXXX')).rejects.toThrow('symbol not found');
  });

  test('fetchStockPrices maneja respuesta de un símbolo y de varios', async () => {
    fetchMock = installFetchMock([
      { match: /symbol=AAPL&/, response: { price: '150' } },
      { match: /symbol=AAPL%2CMSFT%2CBAD&/, response: { AAPL: { price: '150' }, MSFT: { price: '300' }, BAD: { code: 400, status: 'error' } } },
    ]);

    const single = await fetchStockPrices(['AAPL']);
    expect([...single.entries()]).toEqual([['AAPL', 150]]);

    const multi = await fetchStockPrices(['AAPL', 'MSFT', 'BAD']);
    expect(multi.get('AAPL')).toBe(150);
    expect(multi.get('MSFT')).toBe(300);
    expect(multi.has('BAD')).toBe(false);
  });

  test('fetchStockPrices lanza en error global (p. ej. límite de peticiones) y HTTP != 200', async () => {
    fetchMock = installFetchMock([{ match: /\/price/, response: { code: 429, status: 'error', message: 'limit' } }]);
    await expect(fetchStockPrices(['AAPL', 'MSFT'])).rejects.toThrow('limit');
    fetchMock.restore();

    fetchMock = installFetchMock([{ match: /\/price/, status: 500, response: {} }]);
    await expect(fetchStockPrices(['AAPL'])).rejects.toThrow('HTTP 500');
  });

  test('fetchStockPrices sin tickers no llama a la API', async () => {
    fetchMock = installFetchMock([]);
    expect((await fetchStockPrices([])).size).toBe(0);
    expect(fetchMock.calls).toHaveLength(0);
  });

  test('fetchForexData normaliza el par', async () => {
    fetchMock = installFetchMock([{ match: /symbol=EUR%2FUSD/, response: { close: '1.0850' } }]);
    expect(await fetchForexData('EURUSD')).toEqual({ name: 'EUR/USD', currentPrice: 1.085 });
    fetchMock.restore();

    fetchMock = installFetchMock([{ match: /quote/, response: { close: '0' } }]);
    await expect(fetchForexData('EUR/USD')).rejects.toThrow();
  });
});

describe('CoinGecko', () => {
  test('fetchCryptoData usa el id mapeado', async () => {
    fetchMock = installFetchMock([
      { match: /coins\/bitcoin\?/, response: { name: 'Bitcoin', market_data: { current_price: { usd: 65000 } } } },
    ]);
    expect(await fetchCryptoData('BTC')).toEqual({ name: 'Bitcoin', currentPrice: 65000 });
    expect(fetchMock.calls[0].url.startsWith('https://coingecko.test/api/v3')).toBe(true);
  });

  test('fetchCryptoPrices consulta todos los ids en una sola llamada', async () => {
    fetchMock = installFetchMock([
      { match: /simple\/price\?ids=bitcoin,ethereum,newcoin/, response: { bitcoin: { usd: 65000 }, ethereum: { usd: 3000 } } },
    ]);

    const prices = await fetchCryptoPrices(['BTC', 'ETH', 'NEWCOIN']);
    expect(fetchMock.calls).toHaveLength(1);
    expect(prices.get('BTC')).toBe(65000);
    expect(prices.get('ETH')).toBe(3000);
    expect(prices.has('NEWCOIN')).toBe(false);
  });

  test('fetchCryptoPrices propaga errores HTTP', async () => {
    fetchMock = installFetchMock([{ match: /simple\/price/, status: 429, response: {} }]);
    await expect(fetchCryptoPrices(['BTC'])).rejects.toThrow('HTTP 429');
  });
});

describe('fetchAssetData / fetchAssetPrice', () => {
  test('fetchAssetData nunca lanza: devuelve valores por defecto', async () => {
    fetchMock = installFetchMock([{ match: /.*/, status: 500, response: {} }]);
    expect(await fetchAssetData('AAPL', 'STOCK')).toEqual({ name: 'AAPL', currentPrice: 0 });
    expect(await fetchAssetData('XYZ', 'BOND')).toEqual({ name: 'XYZ', currentPrice: 0 });
  });

  test('fetchAssetData despacha por tipo', async () => {
    fetchMock = installFetchMock([
      { match: /quote\?symbol=AAPL/, response: { name: 'Apple', close: '150' } },
      { match: /coins\/ethereum/, response: { name: 'Ethereum', market_data: { current_price: { usd: 3000 } } } },
      { match: /quote\?symbol=EUR%2FUSD/, response: { close: '1.1' } },
    ]);
    expect(await fetchAssetData('AAPL', 'STOCK')).toEqual({ name: 'Apple', currentPrice: 150 });
    expect(await fetchAssetData('ETH', 'CRYPTO')).toEqual({ name: 'Ethereum', currentPrice: 3000 });
    expect(await fetchAssetData('EURUSD', 'FIAT')).toEqual({ name: 'EUR/USD', currentPrice: 1.1 });
  });

  test('fetchAssetPrice lanza si el precio no es válido', async () => {
    fetchMock = installFetchMock([{ match: /coins\/bitcoin/, response: { name: 'Bitcoin', market_data: { current_price: { usd: 0 } } } }]);
    await expect(fetchAssetPrice('BTC', 'CRYPTO')).rejects.toThrow('Precio no disponible');
    await expect(fetchAssetPrice('X', 'BOND')).rejects.toThrow('no soportado');
  });

  test('fetchAssetPrice devuelve el número', async () => {
    fetchMock = installFetchMock([{ match: /quote\?symbol=MSFT/, response: { name: 'Microsoft', close: '300' } }]);
    expect(await fetchAssetPrice('MSFT', 'STOCK')).toBe(300);
  });

  test('las peticiones llevan timeout', async () => {
    fetchMock = installFetchMock([{ match: /.*/, response: { name: 'Apple', close: '1' } }]);
    await fetchStockData('AAPL');
    expect(fetchMock.calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });
});
