import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME, clearAuthCookie } from '@/lib/auth/cookies';

/**
 * Protege /dashboard/*: exige una cookie de sesión con un JWT válido.
 * La verificación se hace en proceso (firma + expiración), sin llamadas HTTP ni a la base de datos;
 * la existencia del usuario la comprueba el cliente con /api/auth/verify.
 */
export function proxy(request) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const home = new URL('/', request.url);

  if (!token) {
    return NextResponse.redirect(home);
  }

  if (!verifyToken(token)) {
    return clearAuthCookie(NextResponse.redirect(home));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
