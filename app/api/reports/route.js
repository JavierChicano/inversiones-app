import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findReportsByUser, createReport } from '@/lib/repository/report.repository';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validateNewReport } from '@/lib/validation/reports';

/**
 * GET /api/reports — listar los informes (radiografías de cartera) del usuario, sin el HTML
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const reports = await findReportsByUser(auth.userId);

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error en GET /api/reports:', error);
    return jsonError('Error al obtener informes', 500);
  }
}

/**
 * POST /api/reports — subir un informe HTML
 * Body: { title, periodStart: 'YYYY-MM', periodEnd: 'YYYY-MM', html, notes? }
 */
export async function POST(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const body = await readJsonBody(request);
    if (!body) return jsonError('Cuerpo de la petición inválido', 400);

    const validation = validateNewReport(body);
    if (!validation.ok) return validationError(validation);

    const report = await createReport({ userId: auth.userId, ...validation.data });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/reports:', error);
    return jsonError('Error al guardar el informe', 500);
  }
}
