/**
 * Generación de dumps SQL (esquema + datos) de la base de datos SQLite/Turso.
 * Lo usan el endpoint /api/cronjobs/backup-db y los scripts de scripts/db.
 *
 * El SQL resultante es estándar de SQLite: se puede restaurar con
 * scripts/db/restore.ts, con `sqlite3 fichero.db < dump.sql` o con `turso db shell`.
 */

const ROWS_PER_INSERT = 100;

export function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes =
      value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `X'${Buffer.from(bytes).toString('hex')}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** DD-MM-YYYY en UTC */
export function formatBackupDate(date = new Date()) {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Nombre de fichero del backup: backup-DD-MM-YYYY.sql */
export function backupFileName(date = new Date()) {
  return `backup-${formatBackupDate(date)}.sql`;
}

/** Ordena las tablas para que las referenciadas por FK vayan antes (padres primero). */
export async function sortTablesByDependencies(client, tableNames) {
  const deps = new Map();
  for (const name of tableNames) {
    const fks = await client.execute(`PRAGMA foreign_key_list(${quoteIdent(name)})`);
    const parents = new Set(
      fks.rows.map((r) => String(r.table)).filter((t) => t !== name && tableNames.includes(t)),
    );
    deps.set(name, parents);
  }

  const ordered = [];
  const visited = new Set();
  const visit = (name, stack = new Set()) => {
    if (visited.has(name)) return;
    if (stack.has(name)) return; // ciclo: se rompe en este punto
    stack.add(name);
    for (const parent of deps.get(name) ?? []) visit(parent, stack);
    stack.delete(name);
    visited.add(name);
    ordered.push(name);
  };
  for (const name of tableNames) visit(name);
  return ordered;
}

/**
 * Genera el dump completo.
 * @param client cliente de @libsql/client
 * @returns {{ sql: string, tables: string[], totalRows: number }}
 */
export async function generateDump(client) {
  const master = await client.execute(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
     ORDER BY rowid`,
  );

  const objects = master.rows.map((r) => ({
    type: String(r.type),
    name: String(r.name),
    tblName: String(r.tbl_name),
    sql: String(r.sql),
  }));

  const tables = objects.filter((o) => o.type === 'table');
  const orderedNames = await sortTablesByDependencies(
    client,
    tables.map((t) => t.name),
  );
  const orderedTables = orderedNames.map((n) => tables.find((t) => t.name === n));

  const lines = [];
  lines.push(`-- Dump de inversiones-app generado el ${new Date().toISOString()}`);
  lines.push(`-- Tablas: ${orderedNames.join(', ')}`);
  lines.push('PRAGMA foreign_keys=OFF;');
  lines.push('BEGIN TRANSACTION;');
  lines.push('');

  // Borrado previo (hijos primero) para que el dump sea autosuficiente
  for (const o of objects.filter((o) => o.type === 'view')) {
    lines.push(`DROP VIEW IF EXISTS ${quoteIdent(o.name)};`);
  }
  for (const t of [...orderedTables].reverse()) {
    lines.push(`DROP TABLE IF EXISTS ${quoteIdent(t.name)};`);
  }
  lines.push('');

  let totalRows = 0;
  for (const table of orderedTables) {
    lines.push(`-- Tabla ${table.name}`);
    lines.push(`${table.sql};`);

    const data = await client.execute(`SELECT * FROM ${quoteIdent(table.name)}`);
    const columns = data.columns.map(quoteIdent).join(', ');
    for (let i = 0; i < data.rows.length; i += ROWS_PER_INSERT) {
      const chunk = data.rows.slice(i, i + ROWS_PER_INSERT);
      const values = chunk
        .map((row) => `(${data.columns.map((_, idx) => sqlValue(row[idx])).join(', ')})`)
        .join(',\n  ');
      lines.push(`INSERT INTO ${quoteIdent(table.name)} (${columns}) VALUES\n  ${values};`);
    }
    totalRows += data.rows.length;
    lines.push(`-- ${data.rows.length} filas`);
    lines.push('');
  }

  // Contadores de AUTOINCREMENT
  const hasSequence = await client.execute(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`,
  );
  if (hasSequence.rows.length > 0) {
    const seq = await client.execute('SELECT name, seq FROM sqlite_sequence');
    lines.push('-- Contadores AUTOINCREMENT');
    lines.push('DELETE FROM sqlite_sequence;');
    for (const row of seq.rows) {
      lines.push(
        `INSERT INTO sqlite_sequence (name, seq) VALUES (${sqlValue(row.name)}, ${sqlValue(row.seq)});`,
      );
    }
    lines.push('');
  }

  // Índices, triggers y vistas (después de los datos, como hace sqlite3 .dump)
  for (const o of objects.filter((o) => o.type !== 'table')) {
    lines.push(`${o.sql};`);
  }
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  return { sql: lines.join('\n'), tables: orderedNames, totalRows };
}
