import { db } from '../db/index.ts';
import { portfolioSnapshots } from '../db/schema.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

/**
 * Obtener snapshots del portfolio con filtros opcionales
 * @param {string} userId - ID del usuario
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de snapshots
 */
export async function findSnapshotsByUser(userId, filters = {}) {
  try {
    const { startDate, endDate, limit = 365 } = filters;
    
    const conditions = [eq(portfolioSnapshots.userId, userId)];

    if (startDate) {
      conditions.push(gte(portfolioSnapshots.date, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(portfolioSnapshots.date, new Date(endDate)));
    }

    const snapshots = await db
      .select()
      .from(portfolioSnapshots)
      .where(and(...conditions))
      .orderBy(desc(portfolioSnapshots.date))
      .limit(limit);

    return snapshots;
  } catch (error) {
    console.error('Error al buscar snapshots:', error);
    throw error;
  }
}

/**
 * Obtener un snapshot por ID
 * @param {string} snapshotId - ID del snapshot
 * @returns {Promise<Object|null>} Snapshot encontrado o null
 */
export async function findSnapshotById(snapshotId) {
  try {
    const result = await db
      .select()
      .from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.id, snapshotId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error al buscar snapshot por ID:', error);
    throw error;
  }
}

/**
 * Crear un nuevo snapshot
 * @param {Object} snapshotData - Datos del snapshot
 * @returns {Promise<Object>} Resultado de la inserción
 */
export async function createSnapshot(snapshotData) {
  try {
    const { userId, date, totalInvested, totalValue, cashBalance = 0 } = snapshotData;

    const result = await db.insert(portfolioSnapshots).values({
      userId,
      date: new Date(date),
      totalInvested: parseFloat(totalInvested),
      totalValue: parseFloat(totalValue),
      cashBalance: parseFloat(cashBalance),
    });

    return result;
  } catch (error) {
    console.error('Error al crear snapshot:', error);
    throw error;
  }
}

/**
 * Actualizar un snapshot
 * @param {string} snapshotId - ID del snapshot
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<void>}
 */
export async function updateSnapshot(snapshotId, updates) {
  try {
    // Parsear campos numéricos si existen
    if (updates.totalInvested !== undefined) {
      updates.totalInvested = parseFloat(updates.totalInvested);
    }
    if (updates.totalValue !== undefined) {
      updates.totalValue = parseFloat(updates.totalValue);
    }
    if (updates.cashBalance !== undefined) {
      updates.cashBalance = parseFloat(updates.cashBalance);
    }
    if (updates.date) {
      updates.date = new Date(updates.date);
    }

    await db
      .update(portfolioSnapshots)
      .set(updates)
      .where(eq(portfolioSnapshots.id, snapshotId));
  } catch (error) {
    console.error('Error al actualizar snapshot:', error);
    throw error;
  }
}

/**
 * Eliminar un snapshot
 * @param {string} snapshotId - ID del snapshot
 * @returns {Promise<void>}
 */
export async function deleteSnapshot(snapshotId) {
  try {
    await db
      .delete(portfolioSnapshots)
      .where(eq(portfolioSnapshots.id, snapshotId));
  } catch (error) {
    console.error('Error al eliminar snapshot:', error);
    throw error;
  }
}
