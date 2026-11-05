import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findAssetByTicker, findAssetsByTickers, upsertAsset } from '@/lib/repository/asset.repository';
import { createLeveragedPosition, findLeveragedPositionsByUser } from '@/lib/repository/leverage.repository';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validateNewLeveragedPosition } from '@/lib/validation/leverage';
import {
  LIQUIDATION_LEVEL,
  calculateLiquidationPrice,
  enrichLeveragedPositions,
  summarizeLeveragedPositions,
} from '@/lib/utils/leverage';

/**
 * GET /api/leverage — resumen, posiciones abiertas (valoradas a precio actual) e historial de cerradas
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const positions = await findLeveragedPositionsByUser(auth.userId);
    const assetRows = await findAssetsByTickers(positions.map((position) => position.assetTicker));
    const assetMap = new Map(assetRows.map((asset) => [asset.ticker, asset]));

    const { openPositions, closedPositions } = enrichLeveragedPositions(positions, assetMap);
    const summary = summarizeLeveragedPositions(openPositions, closedPositions);

    return NextResponse.json({
      summary,
      openPositions,
      closedPositions,
      config: { liquidationLevel: LIQUIDATION_LEVEL },
    });
  } catch (error) {
    console.error('Error al obtener posiciones apalancadas:', error);
    return jsonError('Error al obtener posiciones apalancadas', 500);
  }
}

/**
 * POST /api/leverage — abrir una posición apalancada (crea el asset si no existe)
 */
export async function POST(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const validation = validateNewLeveragedPosition((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const { assetTicker, assetType, ...positionData } = validation.data;

    const existingAsset = await findAssetByTicker(assetTicker);
    if (!existingAsset) {
      await upsertAsset({ ticker: assetTicker, type: assetType });
    }

    const created = await createLeveragedPosition({ ...positionData, assetTicker, userId: auth.userId });

    return NextResponse.json(
      {
        message: 'Posición apalancada abierta exitosamente',
        positionId: created?.id ?? null,
        position: { ...created, liquidationPrice: calculateLiquidationPrice(created) },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al abrir posición apalancada:', error);
    return jsonError('Error al abrir posición apalancada', 500);
  }
}
