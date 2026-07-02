import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createTransaction } from '@/lib/repository/transaction.repository';
import {
  createStakingEvent,
  closeStakingPosition,
  findStakingPositionById,
  updateStakingPosition,
} from '@/lib/repository/staking.repository';
import { calculateAccruedStakingReward } from '@/lib/utils/staking.utils';

function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.userId;
}

export async function POST(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const positionId = parseInt(id, 10);
    const body = await request.json();
    const amountToUnstake = Number(body.amountToUnstake);

    if (!Number.isFinite(positionId) || positionId <= 0) {
      return NextResponse.json({ error: 'Posición inválida' }, { status: 400 });
    }

    if (!Number.isFinite(amountToUnstake) || amountToUnstake <= 0) {
      return NextResponse.json(
        { error: 'La cantidad a retirar debe ser mayor que 0' },
        { status: 400 }
      );
    }

    const position = await findStakingPositionById(positionId, userId);
    if (!position) {
      return NextResponse.json({ error: 'Posición no encontrada' }, { status: 404 });
    }

    const principalBefore = Number(position.amountStaked || 0);
    if (amountToUnstake > principalBefore) {
      return NextResponse.json(
        { error: 'No puedes retirar más de lo que tienes stakeado' },
        { status: 400 }
      );
    }

    const now = new Date();
    const principalWithdrawn = Number(amountToUnstake.toFixed(8));
    const accrued = calculateAccruedStakingReward(
      principalBefore,
      position.manualApy,
      position.lastAccrualAt || position.startDate,
      now
    );
    const pendingRewardAfter = Number(
      ((position.pendingRewardAmount || 0) + accrued.coin).toFixed(8)
    );
    const remainingAmount = Number((principalBefore - principalWithdrawn).toFixed(8));
    const isFullClose = remainingAmount <= 0;
    const rewardClaimed = isFullClose ? pendingRewardAfter : 0;

    if (isFullClose && rewardClaimed > 0) {
      await createTransaction({
        userId,
        assetTicker: position.assetTicker,
        type: 'BUY',
        quantity: rewardClaimed,
        pricePerUnit: 0,
        fees: 0,
        date: now.toISOString(),
        notes: 'Reward claimed by closing staking position',
      });
    }

    await createStakingEvent({
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
    });

    if (isFullClose) {
      await closeStakingPosition(position.id, now, rewardClaimed);
    } else {
      await updateStakingPosition(position.id, {
        amountStaked: remainingAmount,
        pendingRewardAmount: pendingRewardAfter,
        lastAccrualAt: now,
      });
    }

    return NextResponse.json({
      message: 'Retirada de staking procesada',
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
    });
  } catch (error) {
    console.error('Error al retirar staking:', error);
    return NextResponse.json(
      { error: 'Error al procesar la retirada de staking' },
      { status: 500 }
    );
  }
}
