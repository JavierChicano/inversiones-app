import { db } from '@/lib/db/index';
import { portfolioReports } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const REPORT_META_COLUMNS = {
  id: portfolioReports.id,
  title: portfolioReports.title,
  periodStart: portfolioReports.periodStart,
  periodEnd: portfolioReports.periodEnd,
  sizeBytes: portfolioReports.sizeBytes,
  notes: portfolioReports.notes,
  createdAt: portfolioReports.createdAt,
};

/**
 * Listar los informes de un usuario (sin el HTML, solo metadatos)
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function findReportsByUser(userId) {
  return await db
    .select(REPORT_META_COLUMNS)
    .from(portfolioReports)
    .where(eq(portfolioReports.userId, userId))
    .orderBy(desc(portfolioReports.periodEnd), desc(portfolioReports.createdAt), desc(portfolioReports.id));
}

/**
 * Obtener un informe completo (incluye HTML) comprobando que pertenece al usuario
 * @param {number} id
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function findReportById(id, userId) {
  const result = await db
    .select()
    .from(portfolioReports)
    .where(and(eq(portfolioReports.id, id), eq(portfolioReports.userId, userId)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Crear un informe
 * @param {Object} data - { userId, title, periodStart, periodEnd, html, sizeBytes, notes? }
 * @returns {Promise<Object>} Metadatos del informe creado (sin HTML)
 */
export async function createReport(data) {
  const result = await db
    .insert(portfolioReports)
    .values({ ...data, createdAt: data.createdAt || new Date() })
    .returning(REPORT_META_COLUMNS);

  return result[0];
}

/**
 * Actualizar las notas / apuntes de un informe del usuario
 * @param {number} id
 * @param {string} userId
 * @param {string|null} notes - Texto libre; null para borrar las notas
 * @returns {Promise<Object|null>} Metadatos del informe actualizado (sin HTML)
 */
export async function updateReportNotes(id, userId, notes) {
  const result = await db
    .update(portfolioReports)
    .set({ notes })
    .where(and(eq(portfolioReports.id, id), eq(portfolioReports.userId, userId)))
    .returning(REPORT_META_COLUMNS);

  return result.length > 0 ? result[0] : null;
}

/**
 * Eliminar un informe del usuario
 * @param {number} id
 * @param {string} userId
 */
export async function deleteReport(id, userId) {
  return await db
    .delete(portfolioReports)
    .where(and(eq(portfolioReports.id, id), eq(portfolioReports.userId, userId)));
}
