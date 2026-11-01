import { db } from '../db/index.ts';
import { transactions } from '../db/schema.js';
import { eq, desc, and, gte, lte, count } from 'drizzle-orm';

/**
 * Obtener transacciones del usuario con filtros opcionales.
 * Sin `limit` (o con `limit` <= 0) devuelve todas las transacciones.
 * @param {string} userId - ID del usuario
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de transacciones
 */
export async function findTransactionsByUser(userId, filters = {}) {
  const { ticker, type, startDate, endDate, limit = 0, offset = 0 } = filters;

  const conditions = [eq(transactions.userId, userId)];

  if (ticker) conditions.push(eq(transactions.assetTicker, ticker));
  if (type) conditions.push(eq(transactions.type, type));
  if (startDate) conditions.push(gte(transactions.date, new Date(startDate)));
  if (endDate) conditions.push(lte(transactions.date, new Date(endDate)));

  let query = db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.id));

  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit).offset(Number.isFinite(offset) && offset > 0 ? offset : 0);
  }

  return await query;
}

/**
 * Número total de transacciones del usuario
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countTransactionsByUser(userId) {
  const [row] = await db.select({ value: count() }).from(transactions).where(eq(transactions.userId, userId));
  return Number(row?.value) || 0;
}

/**
 * Obtener una transacción por ID
 * @param {number} transactionId - ID de la transacción
 * @returns {Promise<Object|null>} Transacción encontrada o null
 */
export async function findTransactionById(transactionId) {
  const result = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Crear una nueva transacción
 * @param {Object} transactionData - Datos de la transacción
 * @returns {Promise<Object>} Transacción creada
 */
export async function createTransaction(transactionData) {
  const { userId, assetTicker, type, quantity, pricePerUnit, fees = 0, date } = transactionData;

  const [created] = await db
    .insert(transactions)
    .values({
      userId,
      assetTicker,
      type,
      quantity: parseFloat(quantity),
      pricePerUnit: parseFloat(pricePerUnit),
      fees: parseFloat(fees) || 0,
      date: new Date(date),
      createdAt: new Date(),
    })
    .returning();

  return created;
}

/**
 * Actualizar una transacción
 * @param {number} transactionId - ID de la transacción
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<void>}
 */
export async function updateTransaction(transactionId, updates) {
  const safeUpdates = {};

  if (updates.type !== undefined) safeUpdates.type = updates.type;
  if (updates.quantity !== undefined) safeUpdates.quantity = parseFloat(updates.quantity);
  if (updates.pricePerUnit !== undefined) safeUpdates.pricePerUnit = parseFloat(updates.pricePerUnit);
  if (updates.fees !== undefined) safeUpdates.fees = parseFloat(updates.fees) || 0;
  if (updates.date !== undefined) safeUpdates.date = new Date(updates.date);

  if (Object.keys(safeUpdates).length === 0) return;

  await db.update(transactions).set(safeUpdates).where(eq(transactions.id, transactionId));
}

/**
 * Eliminar una transacción
 * @param {number} transactionId - ID de la transacción
 * @returns {Promise<void>}
 */
export async function deleteTransaction(transactionId) {
  await db.delete(transactions).where(eq(transactions.id, transactionId));
}

/**
 * Obtener todas las transacciones de un usuario en orden cronológico
 * @param {string} userId - ID del usuario
 * @returns {Promise<Array>} Lista de transacciones
 */
export async function findAllUserTransactions(userId) {
  return await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(transactions.date, transactions.id);
}

/**
 * Obtener todas las transacciones de todos los usuarios (para el cron de snapshots)
 * @returns {Promise<Array>}
 */
export async function findAllTransactions() {
  return await db.select().from(transactions).orderBy(transactions.date, transactions.id);
}
