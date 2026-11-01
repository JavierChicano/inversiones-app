import { db } from '../db/index.ts';
import { stakingEvents, stakingPositions, transactions } from '../db/schema.js';
import { eq, desc, and, or, isNull } from 'drizzle-orm';
import { calculateAccruedStakingReward } from '../utils/staking.utils.js';

export function roundCoin(value) {
  return Number((Number(value) || 0).toFixed(8));
}

function toDate(value) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function activeCondition() {
  return or(isNull(stakingPositions.closedAt), eq(stakingPositions.status, 'ACTIVE'));
}

/**
 * Obtener posiciones de staking activas del usuario.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function findStakingPositionsByUser(userId) {
  return await db
    .select()
    .from(stakingPositions)
    .where(and(eq(stakingPositions.userId, userId), activeCondition()))
    .orderBy(desc(stakingPositions.createdAt), desc(stakingPositions.id));
}

export async function findActiveStakingPositionByUserAndTicker(userId, assetTicker) {
  const result = await db
    .select()
    .from(stakingPositions)
    .where(and(eq(stakingPositions.userId, userId), eq(stakingPositions.assetTicker, assetTicker), activeCondition()))
    .orderBy(desc(stakingPositions.updatedAt), desc(stakingPositions.id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function findStakingPositionById(positionId, userId) {
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
}

/**
 * Crear una nueva posición de staking o aportar a la activa del mismo ticker.
 * Todo ocurre dentro de una transacción de BD.
 * @param {Object} stakingData
 * @returns {Promise<{action:'created'|'updated', position:Object, event:Object}>}
 */
export async function createStakingPosition(stakingData) {
  const { userId, assetTicker, amountStaked, manualApy, lockPeriodDays = 0, startDate } = stakingData;

  const stakeAmount = roundCoin(amountStaked);
  const apyValue = Number(manualApy) || 0;
  const lockDays = parseInt(lockPeriodDays, 10) || 0;
  const now = toDate(startDate);

  return await db.transaction(async (tx) => {
    const existingPosition = await tx
      .select()
      .from(stakingPositions)
      .where(and(eq(stakingPositions.userId, userId), eq(stakingPositions.assetTicker, assetTicker), activeCondition()))
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

      const [event] = await tx
        .insert(stakingEvents)
        .values({
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
        })
        .returning();

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
          updatedAt: now,
        },
        event,
      };
    }

    const [insertedPosition] = await tx
      .insert(stakingPositions)
      .values({
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
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [event] = await tx
      .insert(stakingEvents)
      .values({
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
      })
      .returning();

    return { action: 'created', position: insertedPosition, event };
  });
}

/**
 * Retirada parcial o total de una posición de staking, en una transacción de BD.
 * Al cerrar por completo, la recompensa pendiente se reclama como compra a coste 0.
 * @param {{ positionId:number, userId:string, amountToUnstake:number, now?:Date }} params
 */
export async function unstakeStakingPosition({ positionId, userId, amountToUnstake, now = new Date() }) {
  return await db.transaction(async (tx) => {
    const [position] = await tx
      .select()
      .from(stakingPositions)
      .where(and(eq(stakingPositions.id, positionId), eq(stakingPositions.userId, userId)))
      .limit(1);

    if (!position) {
      return { error: 'Posición no encontrada', status: 404 };
    }

    const principalBefore = Number(position.amountStaked || 0);
    const principalWithdrawn = roundCoin(amountToUnstake);

    if (principalWithdrawn <= 0) {
      return { error: 'La cantidad a retirar debe ser mayor que 0', status: 400 };
    }

    if (principalWithdrawn > principalBefore) {
      return { error: 'No puedes retirar más de lo que tienes stakeado', status: 400 };
    }

    const accrued = calculateAccruedStakingReward(
      principalBefore,
      position.manualApy,
      position.lastAccrualAt || position.startDate,
      now
    );
    const pendingRewardAfter = roundCoin((position.pendingRewardAmount || 0) + accrued.coin);
    const remainingAmount = roundCoin(principalBefore - principalWithdrawn);
    const isFullClose = remainingAmount <= 0;
    const rewardClaimed = isFullClose ? pendingRewardAfter : 0;

    if (isFullClose && rewardClaimed > 0) {
      await tx.insert(transactions).values({
        userId,
        assetTicker: position.assetTicker,
        type: 'BUY',
        quantity: rewardClaimed,
        pricePerUnit: 0,
        fees: 0,
        date: now,
        createdAt: now,
      });
    }

    const [event] = await tx
      .insert(stakingEvents)
      .values({
        userId,
        stakingPositionId: position.id,
        assetTicker: position.assetTicker,
        eventType: isFullClose ? 'CLOSE' : 'UNSTAKE',
        principalAmount: principalWithdrawn,
        rewardAmount: accrued.coin,
        realizedApy: position.manualApy,
        stakedDays: accrued.days,
        principalBefore,
        principalDelta: -principalWithdrawn,
        principalAfter: isFullClose ? 0 : remainingAmount,
        rewardAccrued: accrued.coin,
        rewardClaimed,
        pendingRewardAfter: isFullClose ? 0 : pendingRewardAfter,
        periodStart: position.lastAccrualAt || position.startDate,
        periodEnd: now,
        note: isFullClose
          ? 'Cierre total de staking y claim de recompensas'
          : 'Retirada parcial de principal; la recompensa queda pendiente',
        createdAt: now,
      })
      .returning();

    if (isFullClose) {
      await tx
        .update(stakingPositions)
        .set({
          amountStaked: 0,
          pendingRewardAmount: 0,
          totalClaimedReward: roundCoin((position.totalClaimedReward || 0) + rewardClaimed),
          status: 'CLOSED',
          closedAt: now,
          lastAccrualAt: now,
          updatedAt: now,
        })
        .where(eq(stakingPositions.id, position.id));
    } else {
      await tx
        .update(stakingPositions)
        .set({
          amountStaked: remainingAmount,
          pendingRewardAmount: pendingRewardAfter,
          lastAccrualAt: now,
          updatedAt: now,
        })
        .where(eq(stakingPositions.id, position.id));
    }

    return {
      positionId: position.id,
      assetTicker: position.assetTicker,
      unstakedAmount: principalWithdrawn,
      rewardAmount: accrued.coin,
      rewardClaimed,
      realizedApy: position.manualApy,
      stakedDays: accrued.days,
      remainingAmount,
      pendingRewardAfter,
      isFullClose,
      event,
    };
  });
}

export async function updateStakingPosition(positionId, updates) {
  const safeUpdates = {};

  if (updates.amountStaked !== undefined) safeUpdates.amountStaked = parseFloat(updates.amountStaked);
  if (updates.manualApy !== undefined) safeUpdates.manualApy = parseFloat(updates.manualApy);
  if (updates.lockPeriodDays !== undefined) safeUpdates.lockPeriodDays = parseInt(updates.lockPeriodDays, 10);
  if (updates.startDate) safeUpdates.startDate = new Date(updates.startDate);
  if (updates.lastAccrualAt) safeUpdates.lastAccrualAt = new Date(updates.lastAccrualAt);
  if (updates.closedAt) safeUpdates.closedAt = new Date(updates.closedAt);
  if (updates.pendingRewardAmount !== undefined) safeUpdates.pendingRewardAmount = parseFloat(updates.pendingRewardAmount);
  if (updates.totalClaimedReward !== undefined) safeUpdates.totalClaimedReward = parseFloat(updates.totalClaimedReward);
  if (updates.status !== undefined) safeUpdates.status = updates.status;

  safeUpdates.updatedAt = new Date();

  await db.update(stakingPositions).set(safeUpdates).where(eq(stakingPositions.id, positionId));
}

export async function closeStakingPosition(positionId, closedAt = new Date(), claimedReward = 0) {
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
}

export async function deleteStakingPosition(positionId) {
  await closeStakingPosition(positionId);
}

export async function createStakingEvent(eventData) {
  const result = await db
    .insert(stakingEvents)
    .values({
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
    })
    .returning();

  return result[0];
}

export async function findStakingEventsByUser(userId, limit = 50) {
  return await db
    .select()
    .from(stakingEvents)
    .where(eq(stakingEvents.userId, userId))
    .orderBy(desc(stakingEvents.createdAt), desc(stakingEvents.id))
    .limit(limit);
}
