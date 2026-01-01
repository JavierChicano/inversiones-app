import { db } from "../db";
import { currencyExchanges } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

export class CurrencyExchangeRepository {
  /**
   * Obtener todos los cambios de divisa de un usuario
   */
  static async getByUserId(userId) {
    return await db
      .select()
      .from(currencyExchanges)
      .where(eq(currencyExchanges.userId, userId))
      .orderBy(desc(currencyExchanges.date));
  }

  /**
   * Crear un nuevo cambio de divisa
   */
  static async create(exchangeData) {
    const result = await db.insert(currencyExchanges).values(exchangeData).returning();
    return result[0];
  }

  /**
   * Obtener un cambio de divisa por ID
   */
  static async getById(id, userId) {
    const result = await db
      .select()
      .from(currencyExchanges)
      .where(
        and(
          eq(currencyExchanges.id, id),
          eq(currencyExchanges.userId, userId)
        )
      );
    return result[0];
  }

  /**
   * Actualizar un cambio de divisa
   */
  static async update(id, userId, exchangeData) {
    const result = await db
      .update(currencyExchanges)
      .set(exchangeData)
      .where(
        and(
          eq(currencyExchanges.id, id),
          eq(currencyExchanges.userId, userId)
        )
      )
      .returning();
    return result[0];
  }

  /**
   * Eliminar un cambio de divisa
   */
  static async delete(id, userId) {
    await db
      .delete(currencyExchanges)
      .where(
        and(
          eq(currencyExchanges.id, id),
          eq(currencyExchanges.userId, userId)
        )
      );
  }

  /**
   * Obtener resumen de cambios de divisa
   */
  static async getSummary(userId) {
    const exchanges = await this.getByUserId(userId);
    
    let totalEurToUsd = 0;
    let totalUsdToEur = 0;
    let amountEurConverted = 0;
    let amountUsdConverted = 0;

    exchanges.forEach(exchange => {
      if (exchange.fromCurrency === 'EUR' && exchange.toCurrency === 'USD') {
        totalEurToUsd += exchange.amount * exchange.exchangeRate;
        amountEurConverted += exchange.amount;
      } else if (exchange.fromCurrency === 'USD' && exchange.toCurrency === 'EUR') {
        totalUsdToEur += exchange.amount * exchange.exchangeRate;
        amountUsdConverted += exchange.amount;
      }
    });

    return {
      totalExchanges: exchanges.length,
      eurToUsd: {
        count: exchanges.filter(e => e.fromCurrency === 'EUR').length,
        totalAmountEur: amountEurConverted,
        totalAmountUsd: totalEurToUsd,
      },
      usdToEur: {
        count: exchanges.filter(e => e.fromCurrency === 'USD').length,
        totalAmountUsd: amountUsdConverted,
        totalAmountEur: totalUsdToEur,
      },
    };
  }
}
