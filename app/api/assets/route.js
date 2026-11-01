import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findAllAssets } from '@/lib/repository/asset.repository';
import { jsonError } from '@/lib/api/http';

/** GET /api/assets — catálogo de assets conocidos (precio, tipo, nombre) */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const assets = await findAllAssets();

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return jsonError('Error al obtener assets', 500);
  }
}
