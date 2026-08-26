import { db } from '@/lib/db/index';
import { portfolioReports } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Listar los informes de un usuario (sin el HTML, solo metadatos)
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function findReportsByUser(userId) {
  return await db
    .select({
      id: portfolioReports.id,
      title: portfolioReports.title,
      periodStart: portfolioReports.periodStart,
      periodEnd: portfolioReports.periodEnd,
      sizeBytes: portfolioReports.sizeBytes,
      createdAt: portfolioReports.createdAt,
    })
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
 * @param {Object} data - { userId, title, periodStart, periodEnd, html, sizeBytes }
 * @returns {Promise<Object>} Metadatos del informe creado (sin HTML)
 */
export async function createReport(data) {
  const result = await db
    .insert(portfolioReports)
    .values({ ...data, createdAt: data.createdAt || new Date() })
    .returning({
      id: portfolioReports.id,
      title: portfolioReports.title,
      periodStart: portfolioReports.periodStart,
      periodEnd: portfolioReports.periodEnd,
      sizeBytes: portfolioReports.sizeBytes,
      createdAt: portfolioReports.createdAt,
    });

  return result[0];
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
