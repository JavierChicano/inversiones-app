# API Endpoints

Todas las rutas (salvo auth y cron) exigen `Authorization: Bearer <JWT>`. Un token ausente o inválido devuelve `401`. Las entradas se validan en `lib/validation/*` y los errores de validación devuelven `400` con `{ error }`.

## Autenticación

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Registro. Body `{ email, password, name? }`. Devuelve token y fija la cookie `auth_token`. `409` si el email existe. |
| `POST` | `/api/auth/login` | Login. Body `{ email, password }`. Migra hashes antiguos a scrypt de forma transparente. |
| `POST` | `/api/auth/logout` | Borra la cookie de sesión. |
| `GET` / `POST` | `/api/auth/verify` | Verifica el token (cabecera o body `{ token }`) y devuelve el usuario. |
| `POST` | `/api/auth/change-password` | Body `{ currentPassword, newPassword, confirmPassword }`. |

## Dashboard y análisis

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/dashboard/stats` | Estadísticas, distribución por activo (con lotes abiertos), progresión de snapshots y transacciones del rango. Incluye `leverage` con el resumen de la operativa apalancada en USD y EUR. Query: `startDate`, `endDate`, `sampleEvery`, `maxSnapshots`, `onlyProgression=1`. |
| `GET` | `/api/analytics/closed-positions` | Análisis de ventas por ticker (EUR), progresión de ganancias y métricas globales. Los cierres apalancados se funden en la fila de su ticker (garantía como invertido y P&L neto como resultado; cada operación lleva `leveraged: true` y la fila `leveragedTrades`) y las métricas desglosan `metrics.spot` y `metrics.leverage`. |
| `GET` | `/api/profile/contributions` | Disciplina de aportación mensual (desde cambios de divisa; si no hay, desde transacciones). |

## Transacciones

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/transactions` | Todas las transacciones del usuario (más recientes primero). Query opcional: `ticker`, `type`, `startDate`, `endDate`, `limit`, `offset`. Sin `limit` devuelve todas. Incluye `total`. |
| `POST` | `/api/transactions` | Body `{ ticker, type: BUY\|SELL, assetType?: STOCK\|CRYPTO, quantity, pricePerUnit, fees?, date }`. Crea el asset si no existe. |
| `GET` / `PUT` / `DELETE` | `/api/transactions/[id]` | Solo sobre transacciones propias (`404` en caso contrario). `PUT` acepta cualquier subconjunto de `type, quantity, pricePerUnit, fees, date`. |

## Assets

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/assets` | Catálogo de assets conocidos. |
| `GET` | `/api/assets/[ticker]` | Datos actuales de un asset (usado por el modal de venta para precargar el precio). |
| `PUT` | `/api/assets/[ticker]` | Corrección manual de `currentPrice` y/o `name`. |
| `POST` | `/api/assets/refresh-user` | Refresca los precios de los activos del usuario (botón "Actualizar"). |

## Divisas

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/currency-exchanges` | Cambios del usuario enriquecidos con tipo actual y P&L, resumen y tipos vigentes. |
| `POST` | `/api/currency-exchanges` | Body `{ fromCurrency, toCurrency, amount, exchangeRate, date }` (EUR/USD). |
| `GET` / `PUT` / `DELETE` | `/api/currency-exchanges/[id]` | Solo sobre cambios propios. |

## Staking

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/staking` | Resumen, posiciones activas (con proyección y movimientos), historial y criptos disponibles. |
| `POST` | `/api/staking` | Body `{ assetTicker, amountStaked, manualApy, lockPeriodDays?, startDate }`. Si ya hay posición activa del ticker, se fusiona (`action: updated`). |
| `POST` | `/api/staking/[id]` | Retirada. Body `{ amountToUnstake }`. Un cierre total reclama la recompensa como compra a coste 0. Todo en una transacción de BD. |

## Apalancar (CFD / margen)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/leverage` | Resumen (garantía, exposición, P&L latente y realizado, riesgo), posiciones abiertas valoradas a precio actual (`evaluation`: P&L bruto/neto, swap devengado, precio y proximidad de liquidación) e historial de cerradas. |
| `POST` | `/api/leverage` | Body `{ assetTicker, assetType?: STOCK|CRYPTO|INDEX|FOREX, direction: LONG|SHORT, margin, leverage, entryPrice, openFee?, spread?, dailySwap?, stopLoss?, takeProfit?, notes?, openedAt }`. Exposición, cantidad y precio de liquidación se calculan en el servidor. Crea el asset si no existe. |
| `GET` / `PUT` / `DELETE` | `/api/leverage/[id]` | Solo sobre posiciones propias (`404` en caso contrario). `PUT` acepta `openedAt, dailySwap, openFee, notes` (y `stopLoss, takeProfit, spread`, que la UI no usa) y solo en posiciones abiertas. |
| `POST` | `/api/leverage/[id]/close` | Body `{ closePrice?, closeFee?, closedAt?, reason?: MANUAL|TAKE_PROFIT|STOP_LOSS|LIQUIDATION }`. Calcula días, comisiones totales, P&L bruto/neto y ROI. En `LIQUIDATION` la pérdida bruta se fija en el 50 % de la garantía y el precio de cierre es opcional. |

## Watchlist

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/watchlist` | Activos en seguimiento con precio actual y estado del objetivo. |
| `POST` | `/api/watchlist` | Body `{ assetTicker, targetPrice?, notes?, assetType? }`. Crea el asset si no existe. |
| `PATCH` / `DELETE` | `/api/watchlist/[id]` | Solo sobre items propios. |

## Informes

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/reports` | Lista de informes (sin HTML). |
| `POST` | `/api/reports` | Body `{ title, periodStart: 'YYYY-MM', periodEnd: 'YYYY-MM', html, notes? }` (máx. 4 MB → `413`). |
| `PATCH` / `DELETE` | `/api/reports/[id]` | `PATCH` actualiza `notes`. |
| `GET` | `/api/reports/[id]/view` | Devuelve el HTML con CSP restrictiva. Acepta el token por cabecera o por la cookie `auth_token`. |

## Cron jobs (`Authorization: Bearer <CRON_SECRET>`)

| Método | Ruta | Programación | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/cronjobs/refresh-assets` | cada 20 min | Refresca precios de todos los usuarios (acciones solo con mercado abierto, assets inactivos omitidos). Con un JWT de usuario refresca solo ese usuario. |
| `POST` | `/api/cronjobs/snapshot` | cada hora | Activa/desactiva assets y guarda un snapshot de cartera por usuario. |
| `POST` | `/api/cronjobs/backup-db` | día 1 de cada mes | Dump SQL completo subido a Cloudflare R2. |
