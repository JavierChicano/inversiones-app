import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { findReportById } from '@/lib/repository/report.repository';

/**
 * GET /api/reports/[id]/view
 * Devuelve el HTML del informe para abrirlo directamente en el navegador.
 * Acepta el token por cabecera Authorization o por la cookie de sesión `auth_token`
 * (necesario para poder abrirlo en una pestaña nueva con un enlace normal).
 */
export async function GET(request, { params }) {
  try {
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const decoded = verifyToken(headerToken || cookieToken);

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const reportId = Number(id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const report = await findReportById(reportId, decoded.userId);
    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
    }

    return new Response(report.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        // Los informes son autocontenidos: se permiten scripts/estilos inline (tooltips, tema)
        // pero se bloquea cualquier conexión saliente con datos del usuario.
        'Content-Security-Policy':
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; font-src data: https:; img-src data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'",
      },
    });
  } catch (error) {
    console.error('Error en GET /api/reports/[id]/view:', error);
    return NextResponse.json({ error: 'Error al cargar el informe' }, { status: 500 });
  }
}
