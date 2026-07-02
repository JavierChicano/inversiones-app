import 'dotenv/config';
import { db } from '../lib/db/index.ts';
import { stakingEvents, stakingPositions } from '../lib/db/schema.js';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { calculateAccruedStakingReward } from '../lib/utils/staking.utils.js';

function roundCoin(value) {
  return Number((Number(value) || 0).toFixed(8));
}

function toDate(value) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function main() {
  const now = new Date();

  const positions = await db
    .select()
    .from(stakingPositions)
    .where(or(isNull(stakingPositions.closedAt), eq(stakingPositions.status, 'ACTIVE')))
    .orderBy(desc(stakingPositions.createdAt), desc(stakingPositions.id));

  const groups = new Map();

  for (const position of positions) {
    const key = `${position.userId}::${position.assetTicker}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(position);
  }

  let consolidatedGroups = 0;
  let mergedPositions = 0;

  for (const groupPositions of groups.values()) {
    if (groupPositions.length <= 1) {
      continue;
    }

    consolidatedGroups += 1;
    const canonical = [...groupPositions].sort((a, b) => {
      const aCreated = toDate(a.createdAt).getTime();
      const bCreated = toDate(b.createdAt).getTime();

      if (aCreated !== bCreated) return aCreated - bCreated;
      return a.id - b.id;
    })[0];

    const duplicates = groupPositions.filter((position) => position.id !== canonical.id);
    const latestPosition = [...groupPositions].sort((a, b) => {
      const aUpdated = toDate(a.updatedAt).getTime();
      const bUpdated = toDate(b.updatedAt).getTime();

      if (aUpdated !== bUpdated) return bUpdated - aUpdated;
      return b.id - a.id;
    })[0];

    const earliestStartDate = groupPositions.reduce((earliest, position) => {
      const currentDate = toDate(position.startDate);
      if (!earliest) return currentDate;
      return currentDate < earliest ? currentDate : earliest;
    }, null);

    let mergedAmount = 0;
    let mergedPendingReward = 0;
    let mergedClaimedReward = 0;

    for (const position of groupPositions) {
      const accrued = calculateAccruedStakingReward(
        position.amountStaked,
        position.manualApy,
        position.lastAccrualAt || position.startDate,
        now
      );

      mergedAmount += Number(position.amountStaked || 0);
      mergedPendingReward += Number(position.pendingRewardAmount || 0) + accrued.coin;
      mergedClaimedReward += Number(position.totalClaimedReward || 0);
    }

    mergedAmount = roundCoin(mergedAmount);
    mergedPendingReward = roundCoin(mergedPendingReward);
    mergedClaimedReward = roundCoin(mergedClaimedReward);

    await db.transaction(async (tx) => {
      await tx
        .update(stakingPositions)
        .set({
          amountStaked: mergedAmount,
          manualApy: latestPosition.manualApy,
          lockPeriodDays: latestPosition.lockPeriodDays,
          startDate: earliestStartDate,
          lastAccrualAt: now,
          pendingRewardAmount: mergedPendingReward,
          totalClaimedReward: mergedClaimedReward,
          status: 'ACTIVE',
          closedAt: null,
          updatedAt: now,
        })
        .where(eq(stakingPositions.id, canonical.id));

      if (duplicates.length > 0) {
        await tx
          .update(stakingEvents)
          .set({ stakingPositionId: canonical.id })
          .where(inArray(stakingEvents.stakingPositionId, duplicates.map((position) => position.id)));

        await tx
          .delete(stakingPositions)
          .where(inArray(stakingPositions.id, duplicates.map((position) => position.id)));
      }
    });

    mergedPositions += duplicates.length;
    console.log(
      `Consolidated ${groupPositions.length} positions for ${canonical.userId}/${canonical.assetTicker} -> kept #${canonical.id}, merged ${duplicates.length}`
    );
  }

  console.log(`Finished. Groups consolidated: ${consolidatedGroups}. Positions merged: ${mergedPositions}.`);
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exitCode = 1;
  });