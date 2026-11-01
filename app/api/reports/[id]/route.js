import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findReportById, deleteReport, updateReportNotes } from '@/lib/repository/report.repository';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { parseReportId, validateReportNotes } from '@/lib/validation/reports';

/**
 * PATCH /api/reports/[id] — actualizar las notas / apuntes de un informe
 * Body: { notes: string } (cadena vacía para borrarlas)
 */
export async function PATCH(request, { params }) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const reportId = parseReportId(id);
    if (!reportId) return jsonError('ID inválido', 400);

    const validation = validateReportNotes((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const report = await updateReportNotes(reportId, auth.userId, validation.data.notes);
    if (!report) return jsonError('Informe no encontrado', 404);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error en PATCH /api/reports/[id]:', error);
    return jsonError('Error al guardar las notas', 500);
  }
}

/**
 * DELETE /api/reports/[id] — eliminar un informe del usuario
 */
export async function DELETE(request, { params }) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const reportId = parseReportId(id);
    if (!reportId) return jsonError('ID inválido', 400);

    const existing = await findReportById(reportId, auth.userId);
    if (!existing) return jsonError('Informe no encontrado', 404);

    await deleteReport(reportId, auth.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en DELETE /api/reports/[id]:', error);
    return jsonError('Error al eliminar el informe', 500);
  }
}
