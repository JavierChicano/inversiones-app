import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import {
  countTransactionsByUser,
  createTransaction,
  findTransactionsByUser,
} from '@/lib/repository/transaction.repository';
import { findAssetByTicker, findAssetsByTickers, upsertAsset } from '@/lib/repository/asset.repository';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validateNewTransaction, TRANSACTION_TYPES } from '@/lib/validation/transaction';
import { normalizeTicker, toValidDate } from '@/lib/validation/common';

function parseNonNegativeInt(value, fallback) {
  const number = parseInt(value ?? '', 10);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

/**
 * GET /api/transactions — transacciones del usuario (más recientes primero).
 * Sin `limit` devuelve todas. Filtros: ticker, type, startDate, endDate, limit, offset.
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || '').toUpperCase();
    const filters = {
      ticker: normalizeTicker(searchParams.get('ticker') || '') || undefined,
      type: TRANSACTION_TYPES.includes(type) ? type : undefined,
      startDate: toValidDate(searchParams.get('startDate')) || undefined,
      endDate: toValidDate(searchParams.get('endDate')) || undefined,
      limit: parseNonNegativeInt(searchParams.get('limit'), 0),
      offset: parseNonNegativeInt(searchParams.get('offset'), 0),
    };

    const [results, total] = await Promise.all([
      findTransactionsByUser(auth.userId, filters),
      countTransactionsByUser(auth.userId),
    ]);

    const assetInfo = await findAssetsByTickers(results.map((tx) => tx.assetTicker));
    const assetMap = new Map(assetInfo.map((asset) => [asset.ticker, asset]));

    const transactions = results.map((tx) => ({
      ...tx,
      asset: assetMap.get(tx.assetTicker),
    }));

    return NextResponse.json({
      transactions,
      total,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return jsonError('Error al obtener transacciones', 500);
  }
}

/**
 * POST /api/transactions — crear transacción (crea el asset si no existe)
 */
export async function POST(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const validation = validateNewTransaction((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const { ticker, type, assetType, quantity, pricePerUnit, fees, date } = validation.data;

    const existingAsset = await findAssetByTicker(ticker);
    if (!existingAsset) {
      await upsertAsset({ ticker, type: assetType });
    }

    const created = await createTransaction({
      userId: auth.userId,
      assetTicker: ticker,
      type,
      quantity,
      pricePerUnit,
      fees,
      date,
    });

    return NextResponse.json(
      {
        message: 'Transacción creada exitosamente',
        transactionId: created?.id ?? null,
        transaction: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating transaction:', error);
    return jsonError('Error al crear transacción', 500);
  }
}
