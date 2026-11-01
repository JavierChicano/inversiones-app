import { db } from '../db/index.ts';
import { currencyExchanges } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { summarizeExchanges } from '../utils/currencyExchangeMetrics.js';

export class CurrencyExchangeRepository {
  /**
   * Obtener todos los cambios de divisa de un usuario (más recientes primero)
   */
  static async getByUserId(userId) {
    return await db
      .select()
      .from(currencyExchanges)
      .where(eq(currencyExchanges.userId, userId))
      .orderBy(desc(currencyExchanges.date), desc(currencyExchanges.id));
  }

  /**
   * Crear un nuevo cambio de divisa
   */
  static async create(exchangeData) {
    const result = await db
      .insert(currencyExchanges)
      .values({ ...exchangeData, createdAt: exchangeData.createdAt || new Date() })
      .returning();
    return result[0];
  }

  /**
   * Obtener un cambio de divisa por ID (solo si pertenece al usuario)
   */
  static async getById(id, userId) {
    const result = await db
      .select()
      .from(currencyExchanges)
      .where(and(eq(currencyExchanges.id, id), eq(currencyExchanges.userId, userId)))
      .limit(1);
    return result[0];
  }

  /**
   * Actualizar un cambio de divisa
   */
  static async update(id, userId, exchangeData) {
    const result = await db
      .update(currencyExchanges)
      .set(exchangeData)
      .where(and(eq(currencyExchanges.id, id), eq(currencyExchanges.userId, userId)))
      .returning();
    return result[0];
  }

  /**
   * Eliminar un cambio de divisa
   */
  static async delete(id, userId) {
    await db
      .delete(currencyExchanges)
      .where(and(eq(currencyExchanges.id, id), eq(currencyExchanges.userId, userId)));
  }

  /**
   * Obtener resumen de cambios de divisa. Acepta la lista ya cargada para evitar una segunda consulta.
   */
  static async getSummary(userId, exchanges) {
    const list = exchanges || (await this.getByUserId(userId));
    return summarizeExchanges(list);
  }
}
