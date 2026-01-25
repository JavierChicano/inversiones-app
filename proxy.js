import { NextResponse } from 'next/server';

export function proxy(request) {
  // Por ahora, el middleware solo verifica en el cliente
  // La verificación real se hace en el componente del dashboard
  return NextResponse.next();
}

// Configurar qué rutas debe proteger el middleware
export const config = {
  matcher: ['/dashboard/:path*'],
};
