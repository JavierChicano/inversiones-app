import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { sortTablesByDependencies } from '../../lib/db/dump.js';

/**
 * Restaura la base de datos Turso a partir de un dump generado por dump.ts.
 *
 * Uso:  bun run scripts/db/restore.ts <ruta/fichero.sql> --yes
 *
 * ⚠️  Borra TODAS las tablas actuales y las sustituye por el contenido del dump.
 *     El dump se ejecuta dentro de una transacción: si algo falla, no se aplica.
 */

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function main() {
  const file = process.argv[2];
  const confirmed = process.argv.includes('--yes');
  if (!file) throw new Error('Uso: restore.ts <fichero.sql> --yes');
  if (!confirmed) {
    throw new Error('Esta operación destruye los datos actuales. Añade --yes para confirmar.');
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('Falta TURSO_DATABASE_URL');

  const sql = readFileSync(file, 'utf8');
  if (!/COMMIT;\s*$/.test(sql)) {
    throw new Error('El fichero no parece un dump completo (no termina en COMMIT;).');
  }

  console.log(`🔄 Restaurando ${file} en ${url.replace(/\?.*$/, '')}`);
  const client = createClient({ url, authToken });

  // 1. Eliminar objetos actuales (hijos primero por las FK), incluidos los que no estén en el dump
  const master = await client.execute(
    `SELECT type, name FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`,
  );
  const views = master.rows.filter((r) => r.type === 'view').map((r) => String(r.name));
  const tables = master.rows.filter((r) => r.type === 'table').map((r) => String(r.name));
  const ordered = await sortTablesByDependencies(client, tables);

  const drops = [
    ...views.map((v) => `DROP VIEW IF EXISTS ${quoteIdent(v)}`),
    ...[...ordered].reverse().map((t) => `DROP TABLE IF EXISTS ${quoteIdent(t)}`),
  ];
  if (drops.length > 0) {
    console.log(`🗑️  Eliminando ${tables.length} tablas y ${views.length} vistas actuales`);
    await client.batch(drops, 'write');
  }

  // 2. Ejecutar el dump (incluye BEGIN/COMMIT)
  console.log('📥 Importando dump...');
  await client.executeMultiple(sql);

  // 3. Verificación
  const after = await client.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  let total = 0;
  for (const row of after.rows) {
    const count = await client.execute(`SELECT count(*) AS n FROM ${quoteIdent(row.name)}`);
    const n = Number(count.rows[0].n);
    total += n;
    console.log(`   ${String(row.name).padEnd(24)} ${n} filas`);
  }
  client.close();
  console.log(`✅ Restauración completada: ${after.rows.length} tablas, ${total} filas`);
}

main().catch((err) => {
  console.error('❌ Error restaurando la base de datos:', err);
  process.exit(1);
});
