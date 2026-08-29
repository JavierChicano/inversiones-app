import { NextResponse } from 'next/server';
import { runDatabaseBackup } from '@/lib/services/backup.service';

// El dump lee toda la BD y la sube a R2; damos margen por encima de los 10s por defecto
export const maxDuration = 60;

export async function POST(req) {
  try {
    // Verificar autenticación
    const authHeader = req.headers.get('authorization');
    const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCronJob) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('=== Cron Job: Backup de la base de datos ===');

    const result = await runDatabaseBackup();

    console.log(
      `Backup subido a r2://${result.bucket}/${result.key} ` +
        `(${result.tables} tablas, ${result.rows} filas, ${(result.bytes / 1024).toFixed(1)} KB)`,
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error en backup de la base de datos:', error);
    return NextResponse.json(
      { error: 'Error al generar el backup', details: error.message },
      { status: 500 },
    );
  }
}
