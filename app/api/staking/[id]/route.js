import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { unstakeStakingPosition } from '@/lib/repository/staking.repository';
import { jsonError, parsePositiveInt, readJsonBody, validationError } from '@/lib/api/http';
import { validateUnstake } from '@/lib/validation/staking';

/**
 * POST /api/staking/[id] — retirada parcial o total de una posición de staking
 * Body: { amountToUnstake }
 */
export async function POST(request, { params }) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const positionId = parsePositiveInt(id);
    if (!positionId) return jsonError('Posición inválida', 400);

    const validation = validateUnstake((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const result = await unstakeStakingPosition({
      positionId,
      userId: auth.userId,
      amountToUnstake: validation.data.amountToUnstake,
    });

    if (result.error) {
      return jsonError(result.error, result.status || 400);
    }

    const { event: _event, ...summary } = result;

    return NextResponse.json({ message: 'Retirada de staking procesada', ...summary });
  } catch (error) {
    console.error('Error al retirar staking:', error);
    return jsonError('Error al procesar la retirada de staking', 500);
  }
}
