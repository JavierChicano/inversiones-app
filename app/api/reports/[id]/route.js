import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { findReportById, deleteReport, updateReportNotes } from '@/lib/repository/report.repository';
import { MAX_REPORT_NOTES_LENGTH } from '@/lib/utils/reports';

function getUserIdFromRequest(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const decoded = verifyToken(token);
  return decoded?.userId || null;
}

function parseReportId(id) {
  const reportId = Number(id);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

/**
 * PATCH /api/reports/[id]
 * Actualizar las notas / apuntes de un informe
 * Body: { notes: string } (cadena vacía para borrarlas)
 */
export async function PATCH(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const reportId = parseReportId(id);
    if (!reportId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    if (typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'Las notas deben ser texto' }, { status: 400 });
    }

    const notes = body.notes.trim();
    if (notes.length > MAX_REPORT_NOTES_LENGTH) {
      return NextResponse.json(
        { error: `Las notas no pueden superar ${MAX_REPORT_NOTES_LENGTH} caracteres` },
        { status: 400 }
      );
    }

    const report = await updateReportNotes(reportId, userId, notes || null);
    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error en PATCH /api/reports/[id]:', error);
    return NextResponse.json({ error: 'Error al guardar las notas' }, { status: 500 });
  }
}

/**
 * DELETE /api/reports/[id]
 * Eliminar un informe del usuario
 */
export async function DELETE(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const reportId = parseReportId(id);
    if (!reportId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await findReportById(reportId, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
    }

    await deleteReport(reportId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en DELETE /api/reports/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar el informe' }, { status: 500 });
  }
}
