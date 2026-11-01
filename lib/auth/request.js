import { NextResponse } from 'next/server';
import { verifyToken } from './jwt.js';

/**
 * Extrae el token Bearer de la cabecera Authorization.
 * @param {Request} request
 * @returns {string|null}
 */
export function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Devuelve el userId del token (cabecera Authorization o, si se permite, cookie `auth_token`).
 * @param {Request} request
 * @param {{ allowCookie?: boolean }} [options]
 * @returns {string|null}
 */
export function getUserIdFromRequest(request, { allowCookie = false } = {}) {
  let token = getBearerToken(request);

  if (!token && allowCookie) {
    token = request.cookies?.get?.('auth_token')?.value || null;
  }

  const decoded = verifyToken(token);
  return decoded?.userId || null;
}

/**
 * Comprueba la autenticación y devuelve el userId o una respuesta 401 lista para devolver.
 * Uso: `const auth = requireUser(request); if (auth.error) return auth.error;`
 * @param {Request} request
 * @param {{ allowCookie?: boolean }} [options]
 * @returns {{ userId: string, error?: undefined } | { userId?: undefined, error: NextResponse }}
 */
export function requireUser(request, options) {
  const userId = getUserIdFromRequest(request, options);

  if (!userId) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  return { userId };
}

/**
 * Indica si la petición viene de un cron job autorizado con CRON_SECRET.
 * @param {Request} request
 * @returns {boolean}
 */
export function isCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return getBearerToken(request) === secret;
}
