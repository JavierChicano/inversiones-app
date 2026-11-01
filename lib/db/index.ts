import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;

if (!url) {
  throw new Error('Falta la variable de entorno TURSO_DATABASE_URL');
}

/** Cliente libsql de bajo nivel (migraciones, tests, SQL crudo). */
export const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

/** Instancia de Drizzle compartida por repositorios y servicios. */
export const db = drizzle({ client });
