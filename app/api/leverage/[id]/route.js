import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findAssetByTicker } from '@/lib/repository/asset.repository';
import {
  deleteLeveragedPosition,
  findLeveragedPositionById,
  updateLeveragedPosition,
} from '@/lib/repository/leverage.repository';
import { jsonError, parsePositiveInt, readJsonBody, validationError } from '@/lib/api/http';
import { validateLeveragedPositionUpdate } from '@/lib/validation/leverage';
import { POSITION_STATUS, calculateLiquidationPrice, evaluateOpenPosition } from '@/lib/utils/leverage';

async function loadOwnedPosition(request, params) {
  const auth = requireUser(request);
  if (auth.error) return { error: auth.error };

  const { id } = await params;
  const positionId = parsePositiveInt(id);
  if (!positionId) {
    return { error: jsonError('ID inválido', 400) };
  }

  const position = await findLeveragedPositionById(positionId, auth.userId);
  if (!position) {
    return { error: jsonError('Posición no encontrada', 404) };
  }

  return { userId: auth.userId, position };
}

/** GET /api/leverage/[id] — una posición con su valoración actual */
export async function GET(request, { params }) {
  try {
    const result = await loadOwnedPosition(request, params);
    if (result.error) return result.error;

    const { position } = result;
    const asset = await findAssetByTicker(position.assetTicker);
    const currentPrice = asset?.currentPrice || 0;

    return NextResponse.json({
      ...position,
      assetName: asset?.name || position.assetTicker,
      assetType: asset?.type || 'STOCK',
      currentPrice,
      liquidationPrice: calculateLiquidationPrice(position),
      evaluation: position.status === POSITION_STATUS.OPEN ? evaluateOpenPosition(position, { currentPrice }) : null,
    });
  } catch (error) {
    console.error('Error al obtener posición apalancada:', error);
    return jsonError('Error al obtener posición apalancada', 500);
  }
}

/** PUT /api/leverage/[id] — editar SL/TP, swap, spread, comisión de apertura o notas (solo abiertas) */
export async function PUT(request, { params }) {
  try {
    const result = await loadOwnedPosition(request, params);
    if (result.error) return result.error;

    if (result.position.status === POSITION_STATUS.CLOSED) {
      return jsonError('No se puede editar una posición cerrada', 400);
    }

    const validation = validateLeveragedPositionUpdate((await readJsonBody(request)) || {}, result.position);
    if (!validation.ok) return validationError(validation);

    await updateLeveragedPosition(result.position.id, validation.data);

    return NextResponse.json({ message: 'Posición actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar posición apalancada:', error);
    return jsonError('Error al actualizar posición apalancada', 500);
  }
}

/** DELETE /api/leverage/[id] — eliminar una posición (abierta o cerrada) */
export async function DELETE(request, { params }) {
  try {
    const result = await loadOwnedPosition(request, params);
    if (result.error) return result.error;

    await deleteLeveragedPosition(result.position.id);

    return NextResponse.json({ message: 'Posición eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar posición apalancada:', error);
    return jsonError('Error al eliminar posición apalancada', 500);
  }
}
