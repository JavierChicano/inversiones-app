export const AUTH_COOKIE_NAME = 'auth_token';
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días, igual que la expiración del JWT

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/** Fija la cookie de sesión en la respuesta */
export function setAuthCookie(response, token) {
  response.cookies.set(AUTH_COOKIE_NAME, token, { ...baseOptions(), maxAge: AUTH_COOKIE_MAX_AGE });
  return response;
}

/** Borra la cookie de sesión */
export function clearAuthCookie(response) {
  response.cookies.set(AUTH_COOKIE_NAME, '', { ...baseOptions(), maxAge: 0 });
  return response;
}
