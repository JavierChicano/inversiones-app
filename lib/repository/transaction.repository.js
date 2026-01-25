import { db } from '../db/index.ts';
import { transactions } from '../db/schema.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

/**
 * Obtener transacciones del usuario con filtros opcionales
 * @param {string} userId - ID del usuario
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de transacciones
 */
export async function findTransactionsByUser(userId, filters = {}) {
  try {
    const { ticker, type, startDate, endDate, limit = 100, offset = 0 } = filters;
    
    const conditions = [eq(transactions.userId, userId)];
    
    if (ticker) {
      conditions.push(eq(transactions.assetTicker, ticker));
    }
    
    if (type) {
      conditions.push(eq(transactions.type, type));
    }
    
    if (startDate) {
      conditions.push(gte(transactions.date, new Date(startDate)));
    }
    
    if (endDate) {
      conditions.push(lte(transactions.date, new Date(endDate)));
    }

    const results = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(limit)
      .offset(offset);

    return results;
  } catch (error) {
    console.error('Error al buscar transacciones:', error);
    throw error;
  }
}

/**
 * Obtener una transacción por ID
 * @param {string} transactionId - ID de la transacción
 * @returns {Promise<Object|null>} Transacción encontrada o null
 */
export async function findTransactionById(transactionId) {
  try {
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error al buscar transacción por ID:', error);
    throw error;
  }
}

/**
 * Crear una nueva transacción
 * @param {Object} transactionData - Datos de la transacción
 * @returns {Promise<Object>} Resultado de la inserción
 */
export async function createTransaction(transactionData) {
  try {
    const {
      userId,
      assetTicker,
      type,
      quantity,
      pricePerUnit,
      fees = 0,
      date,
      notes = '',
    } = transactionData;

    const result = await db.insert(transactions).values({
      userId,
      assetTicker,
      type,
      quantity: parseFloat(quantity),
      pricePerUnit: parseFloat(pricePerUnit),
      fees: parseFloat(fees),
      date: new Date(date),
      notes,
    });

    return result;
  } catch (error) {
    console.error('Error al crear transacción:', error);
    throw error;
  }
}

/**
 * Actualizar una transacción
 * @param {string} transactionId - ID de la transacción
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<void>}
 */
export async function updateTransaction(transactionId, updates) {
  try {
    // Parsear campos numéricos si existen
    if (updates.quantity) updates.quantity = parseFloat(updates.quantity);
    if (updates.pricePerUnit) updates.pricePerUnit = parseFloat(updates.pricePerUnit);
    if (updates.fees !== undefined) updates.fees = parseFloat(updates.fees);
    if (updates.date) updates.date = new Date(updates.date);

    await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, transactionId));
  } catch (error) {
    console.error('Error al actualizar transacción:', error);
    throw error;
  }
}

/**
 * Eliminar una transacción
 * @param {string} transactionId - ID de la transacción
 * @returns {Promise<void>}
 */
export async function deleteTransaction(transactionId) {
  try {
    await db
      .delete(transactions)
      .where(eq(transactions.id, transactionId));
  } catch (error) {
    console.error('Error al eliminar transacción:', error);
    throw error;
  }
}

/**
 * Obtener todas las transacciones de un usuario (sin filtros de paginación)
 * @param {string} userId - ID del usuario
 * @returns {Promise<Array>} Lista de transacciones
 */
export async function findAllUserTransactions(userId) {
  try {
    const results = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(transactions.date, desc(transactions.id));

    return results;
  } catch (error) {
    console.error('Error al obtener todas las transacciones del usuario:', error);
    throw error;
  }
}
