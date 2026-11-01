/**
 * Preload de bun test (ver bunfig.toml).
 * Configura el entorno ANTES de que cualquier test importe la app:
 *  - Base de datos libsql local en un fichero temporal (nunca Turso).
 *  - Secretos de test deterministas.
 *  - Aplica todas las migraciones reales de ./drizzle (valida que la cadena de migraciones es correcta).
 */
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const testDir = join(tmpdir(), `inversiones-app-tests-${process.pid}`);
rmSync(testDir, { recursive: true, force: true });
mkdirSync(testDir, { recursive: true });

const dbPath = join(testDir, 'test.db').replace(/\\/g, '/');

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.JWT_SECRET = 'test-secret-jwt';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.TWELVE_DATA_API_KEY = 'test-twelve-data-key';
process.env.COINGECKO_API_URL = 'https://coingecko.test/api/v3';

const { client } = await import('../lib/db/index.ts');

const migrationsDir = join(process.cwd(), 'drizzle');
const folders = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const folder of folders) {
  const sql = readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^(--.*\n?)+$/.test(statement));

  for (const statement of statements) {
    try {
      await client.execute(statement);
    } catch (error) {
      throw new Error(`Migración ${folder} falló en:\n${statement}\n${error.message}`);
    }
  }
}

process.on('exit', () => {
  try {
    client.close();
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    /* ignorar */
  }
});
