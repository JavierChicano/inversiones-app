import { db } from '../db/index.ts';
import { stakingEvents, stakingPositions } from '../db/schema.js';
import { eq, desc, and, or, isNull } from 'drizzle-orm';
import { calculateAccruedStakingReward } from '../utils/staking.utils.js';

function roundCoin(value) {
  return Number((Number(value) || 0).toFixed(8));
}

function toDate(value) {
  return value ? new Date(value) : new Date();
}

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
      .where(
        and(
          eq(stakingPositions.userId, userId),
          or(isNull(stakingPositions.closedAt), eq(stakingPositions.status, 'ACTIVE'))
        )
      )
      .orderBy(desc(stakingPositions.createdAt), desc(stakingPositions.id));
  } catch (error) {
    console.error('Error al obtener posiciones de staking:', error);
    throw error;
  }
}

export async function findActiveStakingPositionByUserAndTicker(userId, assetTicker) {
  try {
    const result = await db
      .select()
      .from(stakingPositions)
      .where(
        and(
          eq(stakingPositions.userId, userId),
          eq(stakingPositions.assetTicker, assetTicker),
          or(isNull(stakingPositions.closedAt), eq(stakingPositions.status, 'ACTIVE'))
        )
      )
      .orderBy(desc(stakingPositions.updatedAt), desc(stakingPositions.id))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error al buscar posición activa de staking:', error);
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

    const stakeAmount = roundCoin(amountStaked);
    const apyValue = Number(manualApy) || 0;
    const lockDays = parseInt(lockPeriodDays, 10) || 0;
    const now = toDate(startDate);

    return await db.transaction(async (tx) => {
      const existingPosition = await tx
        .select()
        .from(stakingPositions)
        .where(
          and(
            eq(stakingPositions.userId, userId),
            eq(stakingPositions.assetTicker, assetTicker),
            or(isNull(stakingPositions.closedAt), eq(stakingPositions.status, 'ACTIVE'))
          )
        )
        .orderBy(desc(stakingPositions.updatedAt), desc(stakingPositions.id))
        .limit(1);

      if (existingPosition.length > 0) {
        const currentPosition = existingPosition[0];
        const accrued = calculateAccruedStakingReward(
          currentPosition.amountStaked,
          currentPosition.manualApy,
          currentPosition.lastAccrualAt || currentPosition.startDate,
          now
        );

        const pendingRewardAmount = roundCoin((currentPosition.pendingRewardAmount || 0) + accrued.coin);
        const amountAfter = roundCoin((currentPosition.amountStaked || 0) + stakeAmount);

        await tx
          .update(stakingPositions)
          .set({
            amountStaked: amountAfter,
            manualApy: apyValue,
            lockPeriodDays: lockDays,
            pendingRewardAmount,
            lastAccrualAt: now,
            status: 'ACTIVE',
            updatedAt: now,
          })
          .where(eq(stakingPositions.id, currentPosition.id));

        const [event] = await tx.insert(stakingEvents).values({
          userId,
          stakingPositionId: currentPosition.id,
          assetTicker,
          eventType: 'STAKE',
          principalAmount: stakeAmount,
          rewardAmount: accrued.coin,
          realizedApy: apyValue,
          stakedDays: accrued.days,
          principalBefore: currentPosition.amountStaked,
          principalDelta: stakeAmount,
          principalAfter: amountAfter,
          rewardAccrued: accrued.coin,
          rewardClaimed: 0,
          pendingRewardAfter: pendingRewardAmount,
          periodStart: currentPosition.lastAccrualAt || currentPosition.startDate,
          periodEnd: now,
          note: 'Stake adicional sobre posición activa',
          createdAt: now,
        }).returning();

        return {
          action: 'updated',
          position: {
            ...currentPosition,
            amountStaked: amountAfter,
            manualApy: apyValue,
            lockPeriodDays: lockDays,
            pendingRewardAmount,
            lastAccrualAt: now,
            status: 'ACTIVE',
          },
          event,
        };
      }

      const [insertedPosition] = await tx.insert(stakingPositions).values({
        userId,
        assetTicker,
        amountStaked: stakeAmount,
        manualApy: apyValue,
        lockPeriodDays: lockDays,
        startDate: now,
        lastAccrualAt: now,
        pendingRewardAmount: 0,
        totalClaimedReward: 0,
        status: 'ACTIVE',
        updatedAt: now,
      }).returning();

      const [event] = await tx.insert(stakingEvents).values({
        userId,
        stakingPositionId: insertedPosition.id,
        assetTicker,
        eventType: 'STAKE',
        principalAmount: stakeAmount,
        rewardAmount: 0,
        realizedApy: apyValue,
        stakedDays: 0,
        principalBefore: 0,
        principalDelta: stakeAmount,
        principalAfter: stakeAmount,
        rewardAccrued: 0,
        rewardClaimed: 0,
        pendingRewardAfter: 0,
        periodStart: now,
        periodEnd: now,
        note: 'Alta inicial de staking',
        createdAt: now,
      }).returning();

      return {
        action: 'created',
        position: insertedPosition,
        event,
      };
    });
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

    if (updates.lastAccrualAt) {
      updates.lastAccrualAt = new Date(updates.lastAccrualAt);
    }

    if (updates.closedAt) {
      updates.closedAt = new Date(updates.closedAt);
    }

    if (updates.pendingRewardAmount !== undefined) {
      updates.pendingRewardAmount = parseFloat(updates.pendingRewardAmount);
    }

    if (updates.totalClaimedReward !== undefined) {
      updates.totalClaimedReward = parseFloat(updates.totalClaimedReward);
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
    await closeStakingPosition(positionId);
  } catch (error) {
    console.error('Error al eliminar posición de staking:', error);
    throw error;
  }
}

export async function closeStakingPosition(positionId, closedAt = new Date(), claimedReward = 0) {
  try {
    await db
      .update(stakingPositions)
      .set({
        amountStaked: 0,
        pendingRewardAmount: 0,
        totalClaimedReward: parseFloat(claimedReward) || 0,
        status: 'CLOSED',
        closedAt,
        lastAccrualAt: closedAt,
        updatedAt: closedAt,
      })
      .where(eq(stakingPositions.id, positionId));
  } catch (error) {
    console.error('Error al cerrar posición de staking:', error);
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
      principalBefore: parseFloat(eventData.principalBefore || 0),
      principalDelta: parseFloat(eventData.principalDelta || 0),
      principalAfter: parseFloat(eventData.principalAfter || 0),
      rewardAccrued: parseFloat(eventData.rewardAccrued || 0),
      rewardClaimed: parseFloat(eventData.rewardClaimed || 0),
      pendingRewardAfter: parseFloat(eventData.pendingRewardAfter || 0),
      periodStart: eventData.periodStart ? new Date(eventData.periodStart) : null,
      periodEnd: eventData.periodEnd ? new Date(eventData.periodEnd) : null,
      note: eventData.note || null,
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
