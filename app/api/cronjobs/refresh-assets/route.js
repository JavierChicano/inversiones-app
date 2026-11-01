import { NextResponse } from 'next/server';
import { getUserIdFromRequest, isCronRequest } from '@/lib/auth/request';
import { refreshAssetsForUsers } from '@/lib/services/assetRefresh.service';
import { jsonError } from '@/lib/api/http';

// Las llamadas a proveedores externos pueden tardar; margen por encima de los 10s por defecto
export const maxDuration = 60;

/**
 * POST /api/cronjobs/refresh-assets
 *  - Con `Authorization: Bearer <CRON_SECRET>`: refresca los activos de todos los usuarios (modo cron).
 *  - Con un JWT de usuario: refresca solo los activos de ese usuario.
 */
export async function POST(request) {
  try {
    if (isCronRequest(request)) {
      const result = await refreshAssetsForUsers({ userIds: [], isCronJob: true });
      return NextResponse.json(result);
    }

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return jsonError('No autorizado', 401);
    }

    const result = await refreshAssetsForUsers({ userIds: [userId], isCronJob: false });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en refresh-assets:', error);
    return NextResponse.json({ error: 'Error actualizando cartera', details: error.message }, { status: 500 });
  }
}
