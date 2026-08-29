import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient } from '@libsql/client';
import { generateDump, backupFileName } from '../../lib/db/dump.js';

/**
 * Genera un dump SQL completo (esquema + datos) de la base de datos Turso en un fichero.
 *
 * Uso:  bun run scripts/db/dump.ts [ruta/fichero.sql]
 * Si no se indica ruta se genera backups/backup-DD-MM-YYYY.sql
 *
 * En producción el backup mensual lo hace el endpoint /api/cronjobs/backup-db
 * (mismo generador, sube el fichero a Cloudflare R2). Este script es para uso local.
 */

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('Falta TURSO_DATABASE_URL');

  const outFile = process.argv[2] || `backups/${backupFileName()}`;

  const client = createClient({ url, authToken });
  const { sql, tables, totalRows } = await generateDump(client);
  client.close();

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, sql, 'utf8');

  console.log(`✅ Dump generado: ${outFile}`);
  console.log(
    `   ${tables.length} tablas, ${totalRows} filas, ${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB`,
  );
}

main().catch((err) => {
  console.error('❌ Error generando el dump:', err);
  process.exit(1);
});
