import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { findReportById, deleteReport } from '@/lib/repository/report.repository';

/**
 * DELETE /api/reports/[id]
 * Eliminar un informe del usuario
 */
export async function DELETE(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const reportId = Number(id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await findReportById(reportId, decoded.userId);
    if (!existing) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
    }

    await deleteReport(reportId, decoded.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en DELETE /api/reports/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar el informe' }, { status: 500 });
  }
}
