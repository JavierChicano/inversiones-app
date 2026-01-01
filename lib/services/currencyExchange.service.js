import { db } from "../db";
import { assets } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Servicio para obtener tipos de cambio actuales desde la tabla assets
 */
export class CurrencyExchangeService {
  /**
   * Obtener el tipo de cambio actual EUR/USD desde la tabla assets
   */
  static async getCurrentExchangeRate(fromCurrency = 'EUR', toCurrency = 'USD') {
    try {
      // Buscar EURUSD en la tabla assets
      const result = await db
        .select()
        .from(assets)
        .where(eq(assets.ticker, 'EURUSD'));
      
      if (result.length > 0 && result[0].currentPrice) {
        const eurUsdRate = result[0].currentPrice;
        
        // Si piden EUR -> USD, retornar el rate directamente
        if (fromCurrency === 'EUR' && toCurrency === 'USD') {
          return eurUsdRate;
        }
        // Si piden USD -> EUR, retornar el inverso
        if (fromCurrency === 'USD' && toCurrency === 'EUR') {
          return 1 / eurUsdRate;
        }
      }
      
      // Fallback: valor aproximado si no existe en la BD
      if (fromCurrency === 'EUR' && toCurrency === 'USD') {
        return 1.08;
      } else if (fromCurrency === 'USD' && toCurrency === 'EUR') {
        return 0.93;
      }
      
      return 1;
    } catch (error) {
      console.error('Error fetching exchange rate from assets:', error);
      
      // Fallback: retornar un valor aproximado si falla
      if (fromCurrency === 'EUR' && toCurrency === 'USD') {
        return 1.08;
      } else if (fromCurrency === 'USD' && toCurrency === 'EUR') {
        return 0.93;
      }
      
      return 1;
    }
  }

  /**
   * Calcular ganancia/pérdida con el tipo de cambio actual
   * Importante: Se calcula el valor de retorno a la moneda base original
   */
  static calculateProfitLoss(originalAmount, originalRate, currentRate, fromCurrency) {
    // Si cambiamos EUR a USD (ahora tengo USD)
    if (fromCurrency === 'EUR') {
      // Inversión original en EUR
      const originalEur = originalAmount;
      
      // USD que obtuve en el cambio original (EUR * EUR/USD = USD)
      const usdAmount = originalAmount * originalRate;
      
      // Valor actual de esos USD convertidos de vuelta a EUR (USD / EUR/USD = EUR)
      const currentEur = usdAmount / currentRate;
      
      // Ganancia/Pérdida en EUR
      const difference = currentEur - originalEur;
      const percentage = ((difference / originalEur) * 100);
      
      return {
        originalValue: usdAmount, // USD que obtuve
        currentValue: usdAmount,  // Sigo teniendo los mismos USD
        difference, // Diferencia en EUR
        percentage,
        isProfit: difference > 0,
      };
    } 
    // Si cambiamos USD a EUR (ahora tengo EUR)
    else {
      // Inversión original en USD
      const originalUsd = originalAmount;
      
      // EUR que obtuve en el cambio original (USD / USD/EUR = EUR)
      // originalRate es USD/EUR (cuántos USD necesitas por 1 EUR)
      const eurAmount = originalAmount / originalRate;
      
      // Valor actual de esos EUR convertidos de vuelta a USD (EUR / USD/EUR = USD)
      // currentRate es USD/EUR
      const currentUsd = eurAmount / currentRate;
      
      // Ganancia/Pérdida en USD
      const difference = currentUsd - originalUsd;
      const percentage = ((difference / originalUsd) * 100);
      
      return {
        originalValue: eurAmount, // EUR que obtuve
        currentValue: eurAmount,  // Sigo teniendo los mismos EUR
        difference, // Diferencia en USD
        percentage,
        isProfit: difference > 0,
      };
    }
  }

  /**
   * Calcular el tipo de cambio neutral (break-even)
   */
  static calculateBreakEvenRate(originalRate) {
    // El break-even es el mismo rate original
    return originalRate;
  }

  /**
   * Calcular tipo de cambio para un objetivo de ganancia (ej: 5%)
   * Para EUR→USD: queremos que baje el tipo (más EUR por nuestros USD)
   * Para USD→EUR: queremos que suba el tipo (más USD por nuestros EUR)
   */
  static calculateTargetRate(originalRate, targetPercentage = 5, fromCurrency = 'EUR') {
    if (fromCurrency === 'EUR') {
      // EUR→USD: Si tengo USD y quiero ganar 5%, el tipo debe bajar
      return originalRate / (1 + targetPercentage / 100);
    } else {
      // USD→EUR: Si tengo EUR y quiero ganar 5%, el tipo debe subir
      return originalRate * (1 + targetPercentage / 100);
    }
  }

  /**
   * Enriquecer datos de cambio con información actual
   */
  static async enrichExchangeData(exchange) {
    const currentRate = await this.getCurrentExchangeRate(
      exchange.fromCurrency,
      exchange.toCurrency
    );

    const profitLoss = this.calculateProfitLoss(
      exchange.amount,
      exchange.exchangeRate,
      currentRate,
      exchange.fromCurrency
    );

    const breakEvenRate = this.calculateBreakEvenRate(exchange.exchangeRate);
    const goodTargetRate = this.calculateTargetRate(exchange.exchangeRate, 5);
    const excellentTargetRate = this.calculateTargetRate(exchange.exchangeRate, 10);

    return {
      ...exchange,
      currentRate,
      ...profitLoss,
      breakEvenRate,
      goodTargetRate,
      excellentTargetRate,
    };
  }
}
