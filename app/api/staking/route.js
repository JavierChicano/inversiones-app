import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAllAssets } from '@/lib/repository/asset.repository';
import {
  createStakingPosition,
  findStakingEventsByUser,
  findStakingPositionsByUser,
} from '@/lib/repository/staking.repository';
import { calculateStakingProjection, getStakingSummary } from '@/lib/utils/staking.utils';

function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.userId;
}

function buildCryptoHoldings(transactions, assetTypeMap) {
  const holdings = {};

  transactions.forEach((tx) => {
    if (assetTypeMap[tx.assetTicker] !== 'CRYPTO') return;

    if (!holdings[tx.assetTicker]) {
      holdings[tx.assetTicker] = 0;
    }

    if (tx.type === 'BUY') {
      holdings[tx.assetTicker] += tx.quantity;
    }

    if (tx.type === 'SELL') {
      holdings[tx.assetTicker] -= tx.quantity;
    }
  });

  return holdings;
}

export async function GET(request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [positions, transactions, allAssets, stakingEvents] = await Promise.all([
      findStakingPositionsByUser(userId),
      findAllUserTransactions(userId),
      findAllAssets(),
      findStakingEventsByUser(userId, 50),
    ]);

    const assetMap = allAssets.reduce((acc, asset) => {
      acc[asset.ticker] = asset;
      return acc;
    }, {});

    const assetTypeMap = allAssets.reduce((acc, asset) => {
      acc[asset.ticker] = asset.type;
      return acc;
    }, {});

    const cryptoHoldings = buildCryptoHoldings(transactions, assetTypeMap);

    const ownedByTicker = Object.entries(cryptoHoldings)
      .filter(([, quantity]) => quantity > 0)
      .map(([ticker, quantity]) => {
        const currentPrice = assetMap[ticker]?.currentPrice || 0;
        return {
          ticker,
          quantity,
          currentPrice,
          usdValue: quantity * currentPrice,
        };
      })
      .sort((a, b) => b.usdValue - a.usdValue);

    const totalCryptoUsdValue = ownedByTicker.reduce((sum, item) => sum + item.usdValue, 0);

    const enrichedPositions = positions.map((position) => {
      const asset = assetMap[position.assetTicker];
      const currentPrice = asset?.currentPrice || 0;
      const projection = calculateStakingProjection(
        position.amountStaked,
        position.manualApy,
        currentPrice
      );

      return {
        ...position,
        assetName: asset?.name || position.assetTicker,
        currentPrice,
        projection,
      };
    });

    const stakedByTickerMap = enrichedPositions.reduce((acc, position) => {
      if (!acc[position.assetTicker]) {
        acc[position.assetTicker] = {
          ticker: position.assetTicker,
          amountStaked: 0,
          currentPrice: position.currentPrice || 0,
          usdValue: 0,
        };
      }

      acc[position.assetTicker].amountStaked += position.amountStaked;
      acc[position.assetTicker].usdValue +=
        position.amountStaked * (position.currentPrice || 0);

      return acc;
    }, {});

    const stakedByTicker = Object.values(stakedByTickerMap).sort(
      (a, b) => b.usdValue - a.usdValue
    );

    const totalStakedUsdValue = enrichedPositions.reduce(
      (sum, position) => sum + position.amountStaked * (position.currentPrice || 0),
      0
    );

    const summary = getStakingSummary({
      totalCryptoOwned: totalCryptoUsdValue,
      totalStaked: totalStakedUsdValue,
    });

    const availableCryptos = allAssets
      .filter((asset) => asset.type === 'CRYPTO')
      .map((asset) => ({
        ticker: asset.ticker,
        name: asset.name,
        currentPrice: asset.currentPrice || 0,
      }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));

    return NextResponse.json({
      summary: {
        ...summary,
        totalCryptoUsdValue,
        totalStakedUsdValue,
        ownedByTicker,
        stakedByTicker,
      },
      positions: enrichedPositions,
      history: stakingEvents.map((event) => ({
        ...event,
        currentPrice: assetMap[event.assetTicker]?.currentPrice || 0,
        createdAt: new Date(event.createdAt).toISOString(),
      })),
      availableCryptos,
    });
  } catch (error) {
    console.error('Error al obtener datos de staking:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos de staking' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      assetTicker,
      amountStaked,
      manualApy,
      lockPeriodDays,
      startDate,
    } = body;

    if (!assetTicker || amountStaked === undefined || manualApy === undefined || !startDate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    if (Number(amountStaked) <= 0 || Number(manualApy) < 0) {
      return NextResponse.json(
        { error: 'Cantidad y APY deben ser valores válidos' },
        { status: 400 }
      );
    }

    if (lockPeriodDays !== undefined && Number(lockPeriodDays) < 0) {
      return NextResponse.json(
        { error: 'El período de bloqueo no puede ser negativo' },
        { status: 400 }
      );
    }

    const allAssets = await findAllAssets();
    const selectedAsset = allAssets.find((asset) => asset.ticker === assetTicker);

    if (!selectedAsset) {
      return NextResponse.json(
        { error: 'El activo no existe' },
        { status: 400 }
      );
    }

    if (selectedAsset.type !== 'CRYPTO') {
      return NextResponse.json(
        { error: 'Solo se permiten activos de tipo CRYPTO para staking' },
        { status: 400 }
      );
    }

    const userTransactions = await findAllUserTransactions(userId);
    const assetTypeMap = allAssets.reduce((acc, asset) => {
      acc[asset.ticker] = asset.type;
      return acc;
    }, {});

    const holdings = buildCryptoHoldings(userTransactions, assetTypeMap);
    const availableAmount = Number(holdings[assetTicker] || 0);

    if (availableAmount <= 0) {
      return NextResponse.json(
        { error: `No tienes balance disponible de ${assetTicker} para hacer staking` },
        { status: 400 }
      );
    }

    if (Number(amountStaked) > availableAmount) {
      return NextResponse.json(
        { error: `No puedes stakear más de ${availableAmount.toFixed(6)} ${assetTicker}` },
        { status: 400 }
      );
    }

    const result = await createStakingPosition({
      userId,
      assetTicker,
      amountStaked,
      manualApy,
      lockPeriodDays,
      startDate,
    });

    return NextResponse.json(
      {
        message: 'Posición de staking creada exitosamente',
        stakingPositionId: result.lastInsertRowid ? Number(result.lastInsertRowid) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear posición de staking:', error);
    return NextResponse.json(
      { error: 'Error al crear posición de staking' },
      { status: 500 }
    );
  }
}
