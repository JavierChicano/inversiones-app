import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAllAssets, findAssetByTicker } from '@/lib/repository/asset.repository';
import {
  createStakingPosition,
  findStakingEventsByUser,
  findStakingPositionsByUser,
} from '@/lib/repository/staking.repository';
import { calculateStakingProjection, getStakingSummary } from '@/lib/utils/staking.utils';
import { buildHoldings } from '@/lib/utils/portfolio';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validateNewStakingPosition } from '@/lib/validation/staking';

const MAX_HISTORY_EVENTS = 500;

/**
 * GET /api/staking — resumen, posiciones activas, historial y criptos disponibles
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const [positions, transactions, allAssets, stakingEvents] = await Promise.all([
      findStakingPositionsByUser(auth.userId),
      findAllUserTransactions(auth.userId),
      findAllAssets(),
      findStakingEventsByUser(auth.userId, MAX_HISTORY_EVENTS),
    ]);

    const assetMap = new Map(allAssets.map((asset) => [asset.ticker, asset]));
    const cryptoHoldings = buildHoldings(transactions, (ticker) => assetMap.get(ticker)?.type === 'CRYPTO');

    const movementsByPositionId = new Map();
    for (const event of stakingEvents) {
      if (!event.stakingPositionId) continue;
      if (!movementsByPositionId.has(event.stakingPositionId)) movementsByPositionId.set(event.stakingPositionId, []);
      movementsByPositionId.get(event.stakingPositionId).push(event);
    }

    const ownedByTicker = Object.entries(cryptoHoldings)
      .filter(([, quantity]) => quantity > 0)
      .map(([ticker, quantity]) => {
        const currentPrice = assetMap.get(ticker)?.currentPrice || 0;
        return { ticker, quantity, currentPrice, usdValue: quantity * currentPrice };
      })
      .sort((a, b) => b.usdValue - a.usdValue);

    const totalCryptoUsdValue = ownedByTicker.reduce((sum, item) => sum + item.usdValue, 0);

    const enrichedPositions = positions.map((position) => {
      const asset = assetMap.get(position.assetTicker);
      const currentPrice = asset?.currentPrice || 0;

      return {
        ...position,
        assetName: asset?.name || position.assetTicker,
        currentPrice,
        projection: calculateStakingProjection(position.amountStaked, position.manualApy, currentPrice),
        // Los eventos ya vienen ordenados de más reciente a más antiguo
        movements: (movementsByPositionId.get(position.id) || []).map((event) => ({
          ...event,
          currentPrice,
          createdAt: new Date(event.createdAt).toISOString(),
        })),
      };
    });

    const stakedByTickerMap = new Map();
    for (const position of enrichedPositions) {
      if (!stakedByTickerMap.has(position.assetTicker)) {
        stakedByTickerMap.set(position.assetTicker, {
          ticker: position.assetTicker,
          amountStaked: 0,
          currentPrice: position.currentPrice || 0,
          usdValue: 0,
        });
      }
      const entry = stakedByTickerMap.get(position.assetTicker);
      entry.amountStaked += position.amountStaked;
      entry.usdValue += position.amountStaked * (position.currentPrice || 0);
    }

    const stakedByTicker = [...stakedByTickerMap.values()].sort((a, b) => b.usdValue - a.usdValue);
    const totalStakedUsdValue = stakedByTicker.reduce((sum, item) => sum + item.usdValue, 0);

    const summary = getStakingSummary({ totalCryptoOwned: totalCryptoUsdValue, totalStaked: totalStakedUsdValue });

    const availableCryptos = allAssets
      .filter((asset) => asset.type === 'CRYPTO')
      .map((asset) => ({ ticker: asset.ticker, name: asset.name, currentPrice: asset.currentPrice || 0 }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));

    return NextResponse.json({
      summary: { ...summary, totalCryptoUsdValue, totalStakedUsdValue, ownedByTicker, stakedByTicker },
      positions: enrichedPositions,
      history: stakingEvents.map((event) => ({
        ...event,
        currentPrice: assetMap.get(event.assetTicker)?.currentPrice || 0,
        createdAt: new Date(event.createdAt).toISOString(),
      })),
      availableCryptos,
    });
  } catch (error) {
    console.error('Error al obtener datos de staking:', error);
    return jsonError('Error al obtener datos de staking', 500);
  }
}

/**
 * POST /api/staking — crear una posición (o aportar a la activa del mismo ticker)
 */
export async function POST(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const validation = validateNewStakingPosition((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const { assetTicker, amountStaked, manualApy, lockPeriodDays, startDate } = validation.data;

    const selectedAsset = await findAssetByTicker(assetTicker);
    if (!selectedAsset) return jsonError('El activo no existe', 400);
    if (selectedAsset.type !== 'CRYPTO') return jsonError('Solo se permiten activos de tipo CRYPTO para staking', 400);

    const userTransactions = await findAllUserTransactions(auth.userId);
    const holdings = buildHoldings(userTransactions, (ticker) => ticker === assetTicker);
    const availableAmount = Number(holdings[assetTicker] || 0);

    if (availableAmount <= 0) {
      return jsonError(`No tienes balance disponible de ${assetTicker} para hacer staking`, 400);
    }

    if (amountStaked > availableAmount) {
      return jsonError(`No puedes stakear más de ${availableAmount.toFixed(6)} ${assetTicker}`, 400);
    }

    const result = await createStakingPosition({
      userId: auth.userId,
      assetTicker,
      amountStaked,
      manualApy,
      lockPeriodDays,
      startDate,
    });

    return NextResponse.json(
      {
        message:
          result.action === 'updated'
            ? 'Posición de staking actualizada exitosamente'
            : 'Posición de staking creada exitosamente',
        action: result.action,
        stakingPositionId: result.position?.id || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear posición de staking:', error);
    return jsonError('Error al crear posición de staking', 500);
  }
}
