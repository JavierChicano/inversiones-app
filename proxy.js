import { NextResponse } from 'next/server';

export async function proxy(request) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const verifyUrl = new URL('/api/auth/verify', request.url);
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });

    if (!verifyResponse.ok) {
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.set('auth_token', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Error validando token en proxy:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}

// Configurar qué rutas debe proteger el middleware
export const config = {
  matcher: ['/dashboard/:path*'],
};
