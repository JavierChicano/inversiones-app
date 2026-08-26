import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { findReportsByUser, createReport } from '@/lib/repository/report.repository';

const MAX_REPORT_BYTES = 4 * 1024 * 1024; // 4 MB (límite de body en Vercel: 4,5 MB)
const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function getUserIdFromRequest(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const decoded = verifyToken(token);
  return decoded?.userId || null;
}

/**
 * GET /api/reports
 * Listar los informes (radiografías de cartera) del usuario, sin el HTML
 */
export async function GET(request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const reports = await findReportsByUser(userId);

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error en GET /api/reports:', error);
    return NextResponse.json({ error: 'Error al obtener informes' }, { status: 500 });
  }
}

/**
 * POST /api/reports
 * Subir un nuevo informe HTML
 * Body: { title, periodStart: 'YYYY-MM', periodEnd: 'YYYY-MM', html }
 */
export async function POST(request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const title = String(body.title || '').trim();
    const periodStart = String(body.periodStart || '').trim();
    const periodEnd = String(body.periodEnd || '').trim();
    const html = typeof body.html === 'string' ? body.html : '';

    if (!title) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
    }

    if (title.length > 120) {
      return NextResponse.json({ error: 'El título no puede superar 120 caracteres' }, { status: 400 });
    }

    if (!MONTH_KEY_REGEX.test(periodStart) || !MONTH_KEY_REGEX.test(periodEnd)) {
      return NextResponse.json({ error: 'El periodo debe indicarse en formato YYYY-MM' }, { status: 400 });
    }

    if (periodStart > periodEnd) {
      return NextResponse.json({ error: 'El mes inicial no puede ser posterior al mes final' }, { status: 400 });
    }

    if (!html.trim()) {
      return NextResponse.json({ error: 'El archivo HTML está vacío' }, { status: 400 });
    }

    if (!/<(!doctype\s+html|html|body|head)[\s>]/i.test(html)) {
      return NextResponse.json({ error: 'El archivo no parece un documento HTML válido' }, { status: 400 });
    }

    const sizeBytes = Buffer.byteLength(html, 'utf8');
    if (sizeBytes > MAX_REPORT_BYTES) {
      return NextResponse.json(
        { error: `El informe supera el tamaño máximo permitido (${MAX_REPORT_BYTES / (1024 * 1024)} MB)` },
        { status: 413 }
      );
    }

    const report = await createReport({
      userId,
      title,
      periodStart,
      periodEnd,
      html,
      sizeBytes,
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/reports:', error);
    return NextResponse.json({ error: 'Error al guardar el informe' }, { status: 500 });
  }
}
