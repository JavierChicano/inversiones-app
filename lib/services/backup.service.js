import { createClient } from '@libsql/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateDump, backupFileName } from '@/lib/db/dump';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

/** Cliente S3 apuntando a Cloudflare R2 */
export function createR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
    // R2 no soporta los checksums CRC32 que el SDK envía por defecto
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

/**
 * Genera un dump de la base de datos y lo sube a R2 como backup-DD-MM-YYYY.sql.
 * @param {{ prefix?: string, date?: Date }} [options]
 */
export async function runDatabaseBackup({ prefix = '', date = new Date() } = {}) {
  const bucket = requireEnv('R2_BUCKET');
  const r2 = createR2Client(); // valida las credenciales antes de tocar la BD

  const db = createClient({
    url: requireEnv('TURSO_DATABASE_URL'),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  let dump;
  try {
    dump = await generateDump(db);
  } finally {
    db.close();
  }

  const key = `${prefix}${backupFileName(date)}`;
  const body = Buffer.from(dump.sql, 'utf8');

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/sql',
    }),
  );

  return {
    bucket,
    key,
    bytes: body.byteLength,
    tables: dump.tables.length,
    rows: dump.totalRows,
  };
}
