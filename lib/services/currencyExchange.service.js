import { findAssetByTicker } from '../repository/asset.repository.js';
import {
  DEFAULT_EUR_USD_RATE,
  calculateExchangeProfitLoss,
  calculateTargetRate,
  enrichExchange,
} from '../utils/currencyExchangeMetrics.js';

const FX_TICKER = 'EURUSD';

/**
 * Tipo de cambio EUR/USD actual (USD por 1 EUR) leído de la tabla assets.
 * Si no existe o falla la lectura, devuelve un valor aproximado por defecto.
 * @returns {Promise<number>}
 */
export async function getCurrentEurUsdRate() {
  try {
    const asset = await findAssetByTicker(FX_TICKER);
    const rate = Number(asset?.currentPrice);
    return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_EUR_USD_RATE;
  } catch (error) {
    console.error('Error fetching exchange rate from assets:', error);
    return DEFAULT_EUR_USD_RATE;
  }
}

/**
 * Servicio de tipos de cambio. La lógica numérica vive en lib/utils/currencyExchangeMetrics.js.
 */
export class CurrencyExchangeService {
  /**
   * Tipo de cambio actual entre dos divisas (toCurrency por 1 fromCurrency)
   */
  static async getCurrentExchangeRate(fromCurrency = 'EUR', toCurrency = 'USD') {
    const eurUsd = await getCurrentEurUsdRate();

    if (fromCurrency === 'EUR' && toCurrency === 'USD') return eurUsd;
    if (fromCurrency === 'USD' && toCurrency === 'EUR') return 1 / eurUsd;
    return 1;
  }

  static calculateProfitLoss(originalAmount, originalRate, currentRate, fromCurrency) {
    return calculateExchangeProfitLoss(originalAmount, originalRate, currentRate, fromCurrency);
  }

  static calculateBreakEvenRate(originalRate) {
    return originalRate;
  }

  static calculateTargetRate(originalRate, targetPercentage = 5) {
    return calculateTargetRate(originalRate, targetPercentage);
  }

  static async enrichExchangeData(exchange) {
    const eurUsd = await getCurrentEurUsdRate();
    return enrichExchange(exchange, eurUsd);
  }
}
