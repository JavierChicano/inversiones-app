# Backup y restauración de la base de datos (Turso → Cloudflare R2)

## Qué hay

| Fichero | Para qué |
| --- | --- |
| `lib/db/dump.js` | Generador del dump SQL (esquema + datos + contadores autoincrement + índices). Compartido por el endpoint y los scripts. |
| `lib/services/backup.service.js` | Genera el dump y lo sube a R2 con `@aws-sdk/client-s3`. |
| `app/api/cronjobs/backup-db/route.js` | Endpoint protegido con `CRON_SECRET` que ejecuta el backup. Sube `backup-DD-MM-YYYY.sql` al bucket. |
| `.github/workflows/backup-db.yml` | Cron: día 1 de cada mes a las 03:00 UTC hace `curl` al endpoint (igual que los otros cronjobs). También se puede lanzar a mano. |
| `.github/workflows/restore-db.yml` | Solo manual: descarga un backup de R2 y lo restaura en Turso. Antes guarda el estado actual en `pre-restore/`. |
| `scripts/db/dump.ts` | Dump a fichero local (uso manual). |
| `scripts/db/restore.ts` | Borra las tablas actuales e importa un dump. Requiere `--yes`. |

## Variables de entorno

### En Vercel (para el backup mensual)

`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` y `CRON_SECRET` ya existen. Hay que añadir:

| Variable | Valor |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare → R2 → *Account ID* (aparece en la barra lateral de R2 y en la URL del endpoint S3) |
| `R2_ACCESS_KEY_ID` | Cloudflare → R2 → *Manage R2 API Tokens* → crear token con permiso **Object Read & Write** limitado al bucket → *Access Key ID* |
| `R2_SECRET_ACCESS_KEY` | *Secret Access Key* del mismo token (solo se muestra una vez) |
| `R2_BUCKET` | Nombre del bucket (p. ej. `inversiones-backups`) |

### En GitHub (Settings → Secrets and variables → Actions)

- Para el backup: solo `VERCEL_URL` y `CRON_SECRET`, que ya están.
- Para la **restauración** (corre en el runner, no en Vercel): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Si prefieres no ponerlos, restaura en local (ver abajo) descargando el fichero del bucket a mano.

## Restaurar desde GitHub

Actions → *Restaurar base de datos desde backup* → *Run workflow* → indicar el nombre del fichero
(`backup-01-09-2026.sql`) y escribir `RESTAURAR` en el campo de confirmación.

Si el nombre no existe, el job falla y muestra la lista de backups disponibles en el bucket.

## Uso en local

```bash
# Generar dump (por defecto backups/backup-DD-MM-YYYY.sql, carpeta ignorada por git)
bun run db:dump
bun run db:dump ruta/otro-nombre.sql

# Restaurar (¡destruye los datos actuales de TURSO_DATABASE_URL!)
bun run db:restore backups/backup-01-09-2026.sql --yes
```

Para probar contra una copia local en vez de producción:

```bash
TURSO_DATABASE_URL=file:local.db bun run db:restore backups/backup-01-09-2026.sql --yes
```

## Notas

- El dump es SQL estándar de SQLite: también se puede importar con `sqlite3 copia.db < backup.sql` o con `turso db shell <db> < backup.sql`.
- La restauración se ejecuta dentro de una transacción con `foreign_keys=OFF`: o se aplica entera o no se aplica nada.
- Las tablas se vuelcan en orden de dependencias (padres antes que hijos) y se borran en orden inverso.
- En Windows, `next dev` (Turbopack) falla con `@aws-sdk/client-s3` por permisos de symlink (error 1314). Usa `bun run dev -- --webpack` para probar el endpoint en local. En Vercel no afecta.
