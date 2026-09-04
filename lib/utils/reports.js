/** Límites compartidos (cliente y API) para los informes de cartera */

export const MAX_REPORT_BYTES = 4 * 1024 * 1024; // 4 MB (límite de body en Vercel: 4,5 MB)
export const MAX_REPORT_TITLE_LENGTH = 120;
export const MAX_REPORT_NOTES_LENGTH = 20000; // Caracteres máximos de las notas / apuntes de un informe
