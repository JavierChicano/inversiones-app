import { db } from '../db/index.ts';
import { portfolioSnapshots } from '../db/schema.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

/**
 * Obtener snapshots del portfolio con filtros opcionales (más recientes primero)
 * @param {string} userId - ID del usuario
 * @param {Object} filters - Filtros opcionales { startDate, endDate, limit }
 * @returns {Promise<Array>} Lista de snapshots
 */
export async function findSnapshotsByUser(userId, filters = {}) {
  const { startDate, endDate, limit } = filters;

  const conditions = [eq(portfolioSnapshots.userId, userId)];

  if (startDate) {
    const parsed = new Date(startDate);
    if (!Number.isNaN(parsed.getTime())) conditions.push(gte(portfolioSnapshots.date, parsed));
  }

  if (endDate) {
    const parsed = new Date(endDate);
    if (!Number.isNaN(parsed.getTime())) conditions.push(lte(portfolioSnapshots.date, parsed));
  }

  let query = db
    .select()
    .from(portfolioSnapshots)
    .where(and(...conditions))
    .orderBy(desc(portfolioSnapshots.date), desc(portfolioSnapshots.id));

  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  return await query;
}

/**
 * Obtener un snapshot por ID
 * @param {number} snapshotId - ID del snapshot
 * @returns {Promise<Object|null>} Snapshot encontrado o null
 */
export async function findSnapshotById(snapshotId) {
  const result = await db.select().from(portfolioSnapshots).where(eq(portfolioSnapshots.id, snapshotId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

function toSnapshotRow({ userId, date, totalInvested, totalValue }) {
  return {
    userId,
    date: new Date(date),
    totalInvested: parseFloat(totalInvested) || 0,
    totalValue: parseFloat(totalValue) || 0,
  };
}

/**
 * Crear un nuevo snapshot
 * @param {Object} snapshotData - { userId, date, totalInvested, totalValue }
 * @returns {Promise<Object>} Snapshot creado
 */
export async function createSnapshot(snapshotData) {
  const [created] = await db.insert(portfolioSnapshots).values(toSnapshotRow(snapshotData)).returning();
  return created;
}

/**
 * Crear varios snapshots en una sola inserción
 * @param {Array<Object>} snapshots
 * @returns {Promise<Array>} Snapshots creados
 */
export async function createSnapshots(snapshots) {
  if (!snapshots || snapshots.length === 0) return [];
  return await db.insert(portfolioSnapshots).values(snapshots.map(toSnapshotRow)).returning();
}

/**
 * Actualizar un snapshot
 * @param {number} snapshotId - ID del snapshot
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<void>}
 */
export async function updateSnapshot(snapshotId, updates) {
  const safeUpdates = {};
  if (updates.totalInvested !== undefined) safeUpdates.totalInvested = parseFloat(updates.totalInvested);
  if (updates.totalValue !== undefined) safeUpdates.totalValue = parseFloat(updates.totalValue);
  if (updates.date) safeUpdates.date = new Date(updates.date);

  if (Object.keys(safeUpdates).length === 0) return;

  await db.update(portfolioSnapshots).set(safeUpdates).where(eq(portfolioSnapshots.id, snapshotId));
}

/**
 * Eliminar un snapshot
 * @param {number} snapshotId - ID del snapshot
 * @returns {Promise<void>}
 */
export async function deleteSnapshot(snapshotId) {
  await db.delete(portfolioSnapshots).where(eq(portfolioSnapshots.id, snapshotId));
}
