import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getBearerToken } from '@/lib/auth/request';
import { findUserById } from '@/lib/repository/user.repository';
import { jsonError, readJsonBody } from '@/lib/api/http';

async function verifyAndRespond(token) {
  if (!token) {
    return jsonError('Token no proporcionado', 401);
  }

  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return jsonError('Token inválido o expirado', 401);
  }

  const user = await findUserById(decoded.userId);
  if (!user) {
    return jsonError('Usuario no encontrado', 404);
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      currencyPreference: user.currencyPreference,
    },
    valid: true,
  });
}

/** POST /api/auth/verify — token en el cuerpo `{ token }` */
export async function POST(request) {
  try {
    const body = (await readJsonBody(request)) || {};
    return await verifyAndRespond(typeof body.token === 'string' ? body.token : null);
  } catch (error) {
    console.error('Error al verificar token:', error);
    return jsonError('Error al verificar token', 500);
  }
}

/** GET /api/auth/verify — token en la cabecera Authorization */
export async function GET(request) {
  try {
    return await verifyAndRespond(getBearerToken(request));
  } catch (error) {
    console.error('Error al verificar token:', error);
    return jsonError('Error al verificar token', 500);
  }
}
