import { requireUser } from '@/lib/auth/request';
import { findReportById } from '@/lib/repository/report.repository';
import { jsonError } from '@/lib/api/http';
import { parseReportId } from '@/lib/validation/reports';

export const REPORT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; font-src data: https:; img-src data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'";

/**
 * GET /api/reports/[id]/view
 * Devuelve el HTML del informe para abrirlo directamente en el navegador.
 * Acepta el token por cabecera Authorization o por la cookie de sesión `auth_token`
 * (necesario para poder abrirlo en una pestaña nueva con un enlace normal).
 */
export async function GET(request, { params }) {
  try {
    const auth = requireUser(request, { allowCookie: true });
    if (auth.error) return auth.error;

    const { id } = await params;
    const reportId = parseReportId(id);
    if (!reportId) return jsonError('ID inválido', 400);

    const report = await findReportById(reportId, auth.userId);
    if (!report) return jsonError('Informe no encontrado', 404);

    return new Response(report.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        // Los informes son autocontenidos: se permiten scripts/estilos inline (tooltips, tema)
        // pero se bloquea cualquier conexión saliente con datos del usuario.
        'Content-Security-Policy': REPORT_CSP,
      },
    });
  } catch (error) {
    console.error('Error en GET /api/reports/[id]/view:', error);
    return jsonError('Error al cargar el informe', 500);
  }
}
