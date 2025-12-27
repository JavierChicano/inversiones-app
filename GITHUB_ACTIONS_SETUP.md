# Configuración de GitHub Actions para Cron Jobs

## Refresh Assets + Snapshots (GitHub Actions)

Este cron job se ejecuta **cada 20 minutos** usando GitHub Actions y realiza:

1. **Actualiza precios** de todos los assets (stocks, cryptos y forex)
2. **Guarda snapshots** del portfolio de cada usuario

## ¿Por qué GitHub Actions en vez de Vercel Cron?

### GitHub Actions (Plan Gratuito):
- ✅ 2,000 minutos/mes
- ✅ Sin límite de duración por ejecución
- ✅ Más flexibilidad

### Vercel Cron (Plan Hobby):
- ❌ 10 segundos timeout
- ❌ Puede no ser suficiente con muchos usuarios

---

## Configuración en GitHub

### 1. Configurar Secrets en GitHub

Ve a tu repositorio en GitHub:
1. **Settings** → **Secrets and variables** → **Actions**
2. Click en **New repository secret**
3. Agrega estos secrets:

#### `CRON_SECRET`
```
Valor: Una clave aleatoria segura (ej: openssl rand -base64 32)
```

#### `VERCEL_URL`
```
Valor: https://tu-proyecto.vercel.app
```

### 2. El workflow ya está configurado

El archivo `.github/workflows/refresh-assets.yml` ya está creado y se ejecutará automáticamente.

---

## Cómo funciona

### Modos del endpoint `/api/assets/refresh-all`:

1. **Modo cron job** (header `Authorization: Bearer <CRON_SECRET>`):
   - Procesa TODOS los usuarios
   - Actualiza todos los assets
   - Guarda snapshots

2. **Modo usuario individual** (body `{ "userId": "..." }`):
   - Actualiza solo assets de ese usuario
   - No guarda snapshots

GitHub Actions envía el header `Authorization: Bearer <CRON_SECRET>` automáticamente.

---

## Testing

### Test manual desde GitHub:
1. Ve a tu repositorio en GitHub
2. **Actions** → **Actualizar Precios de Assets y Snapshots**
3. Click en **Run workflow** → **Run workflow**

### Test local:
```bash
curl -X POST http://localhost:3000/api/assets/refresh-all \
  -H "Authorization: Bearer tu_cron_secret" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Monitoreo

### Ver ejecuciones:
1. Ve a **Actions** en tu repositorio
2. Click en **Actualizar Precios de Assets y Snapshots**
3. Verás el historial de ejecuciones

### Logs:
Los logs de cada ejecución mostrarán:
```
=== Cron Job: Refresh All Users ===
=== API Usage Stats (refresh-all) ===
Twelve Data: 3 consulta(s) - Tickers: [AAPL, TTWO, EURUSD]
CoinGecko: 1 consulta(s) - Tickers: [BTC]
Total assets actualizados: 4
=== Guardando Snapshots ===
Snapshots creados: 5/5
======================================
```

### Notificaciones:
GitHub te notificará por email si el workflow falla.

---

## Schedule

- **Actual**: `*/20 * * * *` = Cada 20 minutos
- **Formato**: `minuto hora día mes día-semana`

Ejemplos para cambiar:
```yaml
- cron: '*/30 * * * *'  # Cada 30 minutos
- cron: '0 */1 * * *'   # Cada hora
- cron: '0 */6 * * *'   # Cada 6 horas
- cron: '0 0 * * *'     # Una vez al día a medianoche UTC
```

---

## Límites del Plan Gratuito de GitHub

- **2,000 minutos/mes** de ejecución
- Con `*/20 * * * *` (cada 20 minutos):
  - 3 ejecuciones/hora
  - 72 ejecuciones/día
  - ~2,160 ejecuciones/mes
  - Si cada ejecución tarda ~10 segundos = **360 minutos/mes**

✅ **Bien dentro del plan gratuito**

---

## Variables de Entorno en Vercel

Asegúrate de tener estas variables en tu proyecto de Vercel:

```env
# Database
DATABASE_URL=your_turso_database_url
DATABASE_AUTH_TOKEN=your_turso_auth_token

# Authentication
JWT_SECRET=your_jwt_secret_key

# External APIs
TWELVE_DATA_API_KEY=your_twelve_data_api_key
COINGECKO_API_URL=https://api.coingecko.com/api/v3

# Cron Job Security (debe coincidir con el secret de GitHub)
CRON_SECRET=your_random_secret_string
```

---

## Troubleshooting

### El workflow no se ejecuta:
- Verifica que el repositorio sea público o tengas GitHub Pro
- Asegúrate de que los secrets estén configurados
- El primer cron puede tardar hasta 1 hora en activarse

### Error 401 (No autorizado):
- Verifica que `CRON_SECRET` en GitHub coincida con el de Vercel
- Asegúrate de que `VERCEL_URL` sea correcto (sin `/` al final)

### Error de timeout:
- Si tienes muchos usuarios, considera implementar batching
- O reduce la frecuencia del cron
