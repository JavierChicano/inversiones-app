# Dashboard de Inversiones

Aplicación Next.js (App Router) para registrar operaciones de acciones y criptomonedas, cambios de divisa EUR⇄USD, posiciones de staking y operativa apalancada (CFD / margen), y ver el rendimiento de la cartera (valor actual, P&L realizado, análisis de ventas, progresión histórica, informes).

## Stack

- **Next.js 16** + React 19, Tailwind CSS 4, ECharts (build reducido en `lib/charts/echarts.js`).
- **Turso / libsql** con **Drizzle ORM**. Esquema en `lib/db/schema.js`, migraciones SQL en `drizzle/`.
- Autenticación propia con JWT (cookie `auth_token` para el proxy de `/dashboard`, cabecera `Authorization: Bearer` para la API) y contraseñas con scrypt.
- Precios externos: Twelve Data (acciones y forex) y CoinGecko (cripto).
- Cron jobs vía GitHub Actions que llaman a los endpoints de `/api/cronjobs/*` en Vercel (refresco de precios, snapshots diarios, backup mensual a Cloudflare R2).

## Puesta en marcha

```bash
bun install
cp .env.example .env   # o crea .env con las variables de abajo
bun run dev
```

Variables de entorno:

| Variable | Uso |
| --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos (en local puede usarse `file:local.db` sin token) |
| `JWT_SECRET` | Firma de los tokens de sesión (obligatoria en producción) |
| `TWELVE_DATA_API_KEY` | Precios de acciones y forex |
| `COINGECKO_API_URL` | Opcional, por defecto la API pública de CoinGecko |
| `CRON_SECRET` | Autoriza las llamadas de los cron jobs |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Backups en Cloudflare R2 (ver `scripts/db/README.md`) |

Requisitos: **Node.js 26** (LTS; versión indicada en `.node-version`) y **Bun 1.2+**. Next.js 16 funciona con Node ≥ 20.9; en Vercel el proyecto corre con la versión por defecto de la plataforma (24.x), ya que Vercel Functions aún no ofrece Node 26.

> En Windows `next build` falla por permisos de symlink (error 1314); valida los cambios con `bun run dev`. En Vercel el build funciona.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `bun run dev` | Servidor de desarrollo |
| `bun run lint` | ESLint (config de Next + React Hooks) |
| `bun test` | Suite de tests (unitarios, servicios y rutas de la API) |
| `bun run test:watch` | Tests en modo watch |
| `bun run check` | Lint + tests (lo mismo que ejecuta la CI) |
| `bun run db:dump` / `bun run db:restore` | Backup y restauración de la base de datos |
| `npx drizzle-kit migrate` | Aplica las migraciones pendientes de `drizzle/` |

## Tests

Los tests corren con `bun test` y **no tocan Turso**: `tests/setup.js` (cargado vía `bunfig.toml`) crea una base de datos libsql en un fichero temporal, aplica todas las migraciones reales de `drizzle/` y fija secretos de prueba. Esto valida también que la cadena de migraciones es correcta.

- `tests/unit/` — lógica pura: motor de cartera (`lib/utils/portfolio.js`), métricas de divisas, disciplina de aportación, festivos y horario de mercado, formateadores, validadores, contraseñas/JWT, generador de dumps y el proxy.
- `tests/services/` — servicios de precios con `fetch` simulado (sin red) y el refresco de assets contra la BD local.
- `tests/api/` — cada ruta de `app/api/**` invocada directamente (auth, propiedad de los datos, validaciones, cálculos y cron jobs).

Las llamadas a proveedores externos se simulan con `tests/helpers/fetchMock.js`; los helpers de BD y HTTP están en `tests/helpers/`.

## Estructura

```
app/api/            Rutas de la API (handlers finos: auth → validación → repositorio/servicio)
app/dashboard/      Páginas del panel (client components)
components/         UI (tablas, gráficos, modales)
context/            Auth, caché en memoria y modo privacidad
lib/api/            Helpers HTTP (lectura de JSON, respuestas de error)
lib/auth/           JWT, cookies, contraseñas y extracción del usuario de la petición
lib/db/             Cliente, esquema Drizzle y generador de dumps
lib/repository/     Acceso a datos por entidad
lib/services/       Proveedores de precios, refresco de assets, backups
lib/utils/          Cálculo puro: cartera, divisas, aportaciones, mercado, formateo
lib/validation/     Validadores de entrada compartidos por las rutas
drizzle/            Migraciones SQL (una carpeta por migración)
scripts/db/         Dump/restore manual
tests/              Suite de tests (bun test)
```

## Decisiones de cálculo

- Todas las operaciones se guardan en **USD**; el EUR se obtiene con el tipo `EURUSD` de la tabla `assets`.
- Las ventas consumen lotes por **menor coste primero** (a igual precio, el más antiguo) y prorratean las comisiones de compra. El mismo motor (`lib/utils/portfolio.js`) alimenta el dashboard, el análisis de posiciones cerradas y los snapshots del cron, así que los tres son coherentes.
- Las posiciones apalancadas (`lib/utils/leverage.js`) no entran en la cartera al contado: exposición = garantía × multiplicador, cantidad = exposición / precio de entrada, P&L bruto según dirección (largo/corto), comisiones = apertura + cierre + swap × noches, ROI neto sobre la garantía y precio de liquidación al 50 % de la garantía. Una liquidación fija la pérdida bruta en ese 50 %.
- `exchangeRate` en cambios de divisa es siempre "unidades de la divisa destino por 1 unidad de la divisa origen".
- El refresco de precios nunca sobrescribe un precio con `0`: si un proveedor falla, se conserva el valor anterior.
