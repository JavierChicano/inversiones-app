import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { refreshAssetsForUsers } from '@/lib/services/assetRefresh.service';
import { jsonError } from '@/lib/api/http';

/** POST /api/assets/refresh-user — refresca los precios de los activos del usuario autenticado */
export async function POST(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const result = await refreshAssetsForUsers({ userIds: [auth.userId] });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al actualizar assets del usuario:', error);
    return jsonError('Error al actualizar assets', 500);
  }
}
