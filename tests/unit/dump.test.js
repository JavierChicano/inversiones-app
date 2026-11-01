import { describe, expect, test } from 'bun:test';
import { createClient } from '@libsql/client';
import { backupFileName, formatBackupDate, generateDump, quoteIdent, sortTablesByDependencies } from '@/lib/db/dump';

describe('nombres de backup', () => {
  test('DD-MM-YYYY en UTC', () => {
    const date = new Date('2026-09-01T23:30:00Z');
    expect(formatBackupDate(date)).toBe('01-09-2026');
    expect(backupFileName(date)).toBe('backup-01-09-2026.sql');
  });

  test('quoteIdent escapa comillas', () => {
    expect(quoteIdent('users')).toBe('"users"');
    expect(quoteIdent('we"ird')).toBe('"we""ird"');
  });
});

describe('generateDump', () => {
  async function createSampleDb() {
    const client = createClient({ url: ':memory:' });
    await client.executeMultiple(`
      CREATE TABLE parents (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, flag INTEGER, ratio REAL, blob BLOB);
      CREATE TABLE children (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER REFERENCES parents(id), note TEXT);
      CREATE INDEX children_parent_idx ON children(parent_id);
      INSERT INTO parents (name, flag, ratio, blob) VALUES ('O''Neil', 1, 1.5, X'0102');
      INSERT INTO parents (name, flag, ratio, blob) VALUES (NULL, 0, NULL, NULL);
      INSERT INTO children (parent_id, note) VALUES (1, 'hola');
    `);
    return client;
  }

  test('ordena padres antes que hijos', async () => {
    const client = await createSampleDb();
    const ordered = await sortTablesByDependencies(client, ['children', 'parents']);
    expect(ordered).toEqual(['parents', 'children']);
    client.close();
  });

  test('genera SQL restaurable con esquema, datos, secuencias e índices', async () => {
    const client = await createSampleDb();
    const dump = await generateDump(client);
    client.close();

    expect(dump.tables).toEqual(['parents', 'children']);
    expect(dump.totalRows).toBe(3);
    expect(dump.sql).toContain('PRAGMA foreign_keys=OFF;');
    expect(dump.sql).toContain("(1, 'O''Neil', 1, 1.5, X'0102')");
    expect(dump.sql).toContain('(2, NULL, 0, NULL, NULL)');
    expect(dump.sql).toContain('DELETE FROM sqlite_sequence;');
    expect(dump.sql).toContain('CREATE INDEX children_parent_idx');
    expect(dump.sql.trim().endsWith('COMMIT;')).toBe(true);

    // El dump debe poder importarse en una base de datos vacía y reproducir los datos
    const restored = createClient({ url: ':memory:' });
    await restored.executeMultiple(dump.sql);
    const parents = await restored.execute('SELECT * FROM parents ORDER BY id');
    const children = await restored.execute('SELECT * FROM children');
    const seq = await restored.execute("SELECT seq FROM sqlite_sequence WHERE name = 'parents'");
    restored.close();

    expect(parents.rows).toHaveLength(2);
    expect(parents.rows[0].name).toBe("O'Neil");
    expect(children.rows[0].note).toBe('hola');
    expect(Number(seq.rows[0].seq)).toBe(2);
  });
});
