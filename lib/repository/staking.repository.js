import { db } from '../db/index.ts';
import { stakingEvents, stakingPositions } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

/**
 * Obtener posiciones de staking del usuario.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function findStakingPositionsByUser(userId) {
  try {
    return await db
      .select()
      .from(stakingPositions)
      .where(eq(stakingPositions.userId, userId))
      .orderBy(desc(stakingPositions.createdAt), desc(stakingPositions.id));
  } catch (error) {
    console.error('Error al obtener posiciones de staking:', error);
    throw error;
  }
}

export async function findStakingPositionById(positionId, userId) {
  try {
    const conditions = [eq(stakingPositions.id, positionId)];

    if (userId) {
      conditions.push(eq(stakingPositions.userId, userId));
    }

    const result = await db
      .select()
      .from(stakingPositions)
      .where(and(...conditions))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error al buscar posición de staking por ID:', error);
    throw error;
  }
}

/**
 * Crear una nueva posición de staking.
 * @param {Object} stakingData
 * @returns {Promise<Object>} Resultado de inserción
 */
export async function createStakingPosition(stakingData) {
  try {
    const {
      userId,
      assetTicker,
      amountStaked,
      manualApy,
      lockPeriodDays = 0,
      startDate,
    } = stakingData;

    const [insertedPosition] = await db.insert(stakingPositions).values({
      userId,
      assetTicker,
      amountStaked: parseFloat(amountStaked),
      manualApy: parseFloat(manualApy),
      lockPeriodDays: parseInt(lockPeriodDays, 10) || 0,
      startDate: new Date(startDate),
      updatedAt: new Date(),
    }).returning();

    await db.insert(stakingEvents).values({
      userId,
      stakingPositionId: insertedPosition.id,
      assetTicker,
      eventType: 'STAKE',
      principalAmount: parseFloat(amountStaked),
      rewardAmount: 0,
      realizedApy: parseFloat(manualApy),
      stakedDays: 0,
      createdAt: new Date(startDate),
    });

    return insertedPosition;
  } catch (error) {
    console.error('Error al crear posición de staking:', error);
    throw error;
  }
}

export async function updateStakingPosition(positionId, updates) {
  try {
    if (updates.amountStaked !== undefined) {
      updates.amountStaked = parseFloat(updates.amountStaked);
    }

    if (updates.manualApy !== undefined) {
      updates.manualApy = parseFloat(updates.manualApy);
    }

    if (updates.lockPeriodDays !== undefined) {
      updates.lockPeriodDays = parseInt(updates.lockPeriodDays, 10);
    }

    if (updates.startDate) {
      updates.startDate = new Date(updates.startDate);
    }

    updates.updatedAt = new Date();

    await db
      .update(stakingPositions)
      .set(updates)
      .where(eq(stakingPositions.id, positionId));
  } catch (error) {
    console.error('Error al actualizar posición de staking:', error);
    throw error;
  }
}

export async function deleteStakingPosition(positionId) {
  try {
    await db
      .delete(stakingPositions)
      .where(eq(stakingPositions.id, positionId));
  } catch (error) {
    console.error('Error al eliminar posición de staking:', error);
    throw error;
  }
}

export async function createStakingEvent(eventData) {
  try {
    const result = await db.insert(stakingEvents).values({
      userId: eventData.userId,
      stakingPositionId: eventData.stakingPositionId,
      assetTicker: eventData.assetTicker,
      eventType: eventData.eventType,
      principalAmount: parseFloat(eventData.principalAmount),
      rewardAmount: parseFloat(eventData.rewardAmount || 0),
      realizedApy: parseFloat(eventData.realizedApy || 0),
      stakedDays: parseInt(eventData.stakedDays || 0, 10),
      createdAt: eventData.createdAt ? new Date(eventData.createdAt) : new Date(),
    }).returning();

    return result[0];
  } catch (error) {
    console.error('Error al crear evento de staking:', error);
    throw error;
  }
}

export async function findStakingEventsByUser(userId, limit = 50) {
  try {
    return await db
      .select()
      .from(stakingEvents)
      .where(eq(stakingEvents.userId, userId))
      .orderBy(desc(stakingEvents.createdAt), desc(stakingEvents.id))
      .limit(limit);
  } catch (error) {
    console.error('Error al obtener eventos de staking:', error);
    throw error;
  }
}
