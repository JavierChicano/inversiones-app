import { db } from '../db/index.ts';
import { leveragedPositions } from '../db/schema.js';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  POSITION_STATUS,
  calculateExposure,
  calculateQuantity,
  settleLeveragedPosition,
} from '../utils/leverage.js';

const UPDATABLE_FIELDS = ['stopLoss', 'takeProfit', 'dailySwap', 'spread', 'openFee', 'notes', 'openedAt'];

/**
 * Posiciones apalancadas del usuario. Abiertas primero (por fecha de apertura desc),
 * después cerradas (por fecha de cierre desc).
 * @param {string} userId
 * @param {{ status?: 'OPEN'|'CLOSED' }} [filters]
 */
export async function findLeveragedPositionsByUser(userId, { status } = {}) {
  const conditions = [eq(leveragedPositions.userId, userId)];
  if (status) conditions.push(eq(leveragedPositions.status, status));

  const rows = await db
    .select()
    .from(leveragedPositions)
    .where(and(...conditions))
    .orderBy(desc(leveragedPositions.openedAt), desc(leveragedPositions.id));

  const time = (value) => (value ? new Date(value).getTime() : 0);
  return rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === POSITION_STATUS.OPEN ? -1 : 1;
    if (a.status === POSITION_STATUS.CLOSED) return time(b.closedAt) - time(a.closedAt) || b.id - a.id;
    return time(b.openedAt) - time(a.openedAt) || b.id - a.id;
  });
}

/**
 * Una posición por id; si se indica userId solo devuelve la del propietario.
 * @param {number} positionId
 * @param {string} [userId]
 */
export async function findLeveragedPositionById(positionId, userId) {
  const conditions = [eq(leveragedPositions.id, positionId)];
  if (userId) conditions.push(eq(leveragedPositions.userId, userId));

  const result = await db
    .select()
    .from(leveragedPositions)
    .where(and(...conditions))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Abre una posición. Exposición y cantidad se calculan aquí (no se aceptan del cliente).
 * @param {object} data datos ya validados (validateNewLeveragedPosition) + userId
 */
export async function createLeveragedPosition(data) {
  const now = new Date();
  const exposure = calculateExposure(data.margin, data.leverage);
  const quantity = calculateQuantity(exposure, data.entryPrice);

  const [created] = await db
    .insert(leveragedPositions)
    .values({
      userId: data.userId,
      assetTicker: data.assetTicker,
      direction: data.direction,
      margin: Number(data.margin),
      leverage: Number(data.leverage),
      exposure,
      entryPrice: Number(data.entryPrice),
      quantity,
      openFee: Number(data.openFee) || 0,
      spread: Number(data.spread) || 0,
      dailySwap: Number(data.dailySwap) || 0,
      stopLoss: data.stopLoss ?? null,
      takeProfit: data.takeProfit ?? null,
      notes: data.notes ?? null,
      openedAt: new Date(data.openedAt),
      status: POSITION_STATUS.OPEN,
      closeFee: 0,
      daysHeld: 0,
      swapTotal: 0,
      totalFees: 0,
      grossPnl: 0,
      netPnl: 0,
      roi: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

/**
 * Actualiza campos editables de una posición (SL/TP, swap, spread, comisión de apertura, notas, fecha de apertura).
 * @param {number} positionId
 * @param {object} updates
 */
export async function updateLeveragedPosition(positionId, updates = {}) {
  const safeUpdates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (updates[field] !== undefined) safeUpdates[field] = updates[field];
  }
  if (safeUpdates.openedAt !== undefined) safeUpdates.openedAt = new Date(safeUpdates.openedAt);

  if (Object.keys(safeUpdates).length === 0) return;

  safeUpdates.updatedAt = new Date();
  await db.update(leveragedPositions).set(safeUpdates).where(eq(leveragedPositions.id, positionId));
}

/**
 * Cierra una posición abierta aplicando las fórmulas del motor, en una transacción de BD.
 * @param {{ positionId:number, userId:string, closePrice?:number, closeFee?:number, closedAt?:Date, reason?:string }} params
 * @returns {Promise<{ error?: string, status?: number, position?: object }>}
 */
export async function closeLeveragedPosition({ positionId, userId, closePrice, closeFee = 0, closedAt = new Date(), reason = 'MANUAL' }) {
  return await db.transaction(async (tx) => {
    const [position] = await tx
      .select()
      .from(leveragedPositions)
      .where(and(eq(leveragedPositions.id, positionId), eq(leveragedPositions.userId, userId)))
      .limit(1);

    if (!position) {
      return { error: 'Posición no encontrada', status: 404 };
    }

    if (position.status === POSITION_STATUS.CLOSED) {
      return { error: 'La posición ya está cerrada', status: 400 };
    }

    const closeDate = new Date(closedAt);
    if (closeDate.getTime() < new Date(position.openedAt).getTime()) {
      return { error: 'La fecha de cierre no puede ser anterior a la de apertura', status: 400 };
    }

    const settlement = settleLeveragedPosition(position, { closePrice, closeFee, closedAt: closeDate, reason });
    const updatedAt = new Date();

    await tx
      .update(leveragedPositions)
      .set({ ...settlement, updatedAt })
      .where(eq(leveragedPositions.id, position.id));

    return { position: { ...position, ...settlement, updatedAt } };
  });
}

/** Elimina una posición (abierta o cerrada). */
export async function deleteLeveragedPosition(positionId) {
  await db.delete(leveragedPositions).where(eq(leveragedPositions.id, positionId));
}

/** Tickers con alguna posición apalancada abierta (todos los usuarios; para el cron). */
export async function findAllOpenLeveragedTickers() {
  const rows = await db
    .selectDistinct({ ticker: leveragedPositions.assetTicker })
    .from(leveragedPositions)
    .where(eq(leveragedPositions.status, POSITION_STATUS.OPEN));

  return rows.map((row) => row.ticker);
}

/** Tickers con posiciones apalancadas abiertas de los usuarios indicados (refresco de precios). */
export async function findOpenLeveragedTickersByUsers(userIds = []) {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return [];

  const rows = await db
    .selectDistinct({ ticker: leveragedPositions.assetTicker })
    .from(leveragedPositions)
    .where(and(inArray(leveragedPositions.userId, ids), eq(leveragedPositions.status, POSITION_STATUS.OPEN)));

  return rows.map((row) => row.ticker);
}
