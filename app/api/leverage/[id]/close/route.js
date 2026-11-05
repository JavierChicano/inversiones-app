import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { closeLeveragedPosition } from '@/lib/repository/leverage.repository';
import { jsonError, parsePositiveInt, readJsonBody, validationError } from '@/lib/api/http';
import { validateCloseLeveragedPosition } from '@/lib/validation/leverage';

/**
 * POST /api/leverage/[id]/close — cerrar una posición apalancada
 * Body: { closePrice?, closeFee?, closedAt?, reason?: MANUAL|TAKE_PROFIT|STOP_LOSS|LIQUIDATION }
 * En liquidación la pérdida se fija en el 50 % de la garantía más las comisiones acumuladas.
 */
export async function POST(request, { params }) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const positionId = parsePositiveInt(id);
    if (!positionId) return jsonError('ID inválido', 400);

    const validation = validateCloseLeveragedPosition((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const result = await closeLeveragedPosition({
      positionId,
      userId: auth.userId,
      ...validation.data,
    });

    if (result.error) {
      return jsonError(result.error, result.status || 400);
    }

    return NextResponse.json({ message: 'Posición cerrada exitosamente', position: result.position });
  } catch (error) {
    console.error('Error al cerrar posición apalancada:', error);
    return jsonError('Error al cerrar posición apalancada', 500);
  }
}
