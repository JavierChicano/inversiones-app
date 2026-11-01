import { fail, ok } from './common.js';
import { MAX_REPORT_BYTES, MAX_REPORT_NOTES_LENGTH, MAX_REPORT_TITLE_LENGTH } from '../utils/reports.js';

export const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const HTML_DOCUMENT_REGEX = /<(!doctype\s+html|html|body|head)[\s>]/i;

export function parseReportId(id) {
  const reportId = Number(id);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

export function validateNewReport(body = {}) {
  const title = String(body.title || '').trim();
  const periodStart = String(body.periodStart || '').trim();
  const periodEnd = String(body.periodEnd || '').trim();
  const html = typeof body.html === 'string' ? body.html : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (!title) {
    return fail('El título es obligatorio');
  }

  if (title.length > MAX_REPORT_TITLE_LENGTH) {
    return fail(`El título no puede superar ${MAX_REPORT_TITLE_LENGTH} caracteres`);
  }

  if (notes.length > MAX_REPORT_NOTES_LENGTH) {
    return fail(`Las notas no pueden superar ${MAX_REPORT_NOTES_LENGTH} caracteres`);
  }

  if (!MONTH_KEY_REGEX.test(periodStart) || !MONTH_KEY_REGEX.test(periodEnd)) {
    return fail('El periodo debe indicarse en formato YYYY-MM');
  }

  if (periodStart > periodEnd) {
    return fail('El mes inicial no puede ser posterior al mes final');
  }

  if (!html.trim()) {
    return fail('El archivo HTML está vacío');
  }

  if (!HTML_DOCUMENT_REGEX.test(html)) {
    return fail('El archivo no parece un documento HTML válido');
  }

  const sizeBytes = Buffer.byteLength(html, 'utf8');
  if (sizeBytes > MAX_REPORT_BYTES) {
    return fail(
      `El informe supera el tamaño máximo permitido (${MAX_REPORT_BYTES / (1024 * 1024)} MB)`,
      413
    );
  }

  return ok({ title, periodStart, periodEnd, html, sizeBytes, notes: notes || null });
}

export function validateReportNotes(body = {}) {
  if (typeof body.notes !== 'string') {
    return fail('Las notas deben ser texto');
  }

  const notes = body.notes.trim();
  if (notes.length > MAX_REPORT_NOTES_LENGTH) {
    return fail(`Las notas no pueden superar ${MAX_REPORT_NOTES_LENGTH} caracteres`);
  }

  return ok({ notes: notes || null });
}
