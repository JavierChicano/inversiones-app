# Asset Data Service

Este servicio se encarga de obtener datos de assets (acciones y criptomonedas) desde APIs externas.

## APIs Utilizadas

### 1. CoinGecko (Criptomonedas)
- **API:** https://api.coingecko.com/api/v3
- **Tipo:** Gratuita, sin API key necesaria
- **Datos proporcionados:**
  - Nombre completo (`/coins/{id}`, solo al crear el asset)
  - Precio actual en USD (`/simple/price`, todos los tickers en una sola llamada en el refresco)
  
**Tickers soportados:**
- BTC, ETH, USDT, BNB, SOL, XRP, USDC, ADA, DOGE, TRX, TON, LINK, AVAX, DOT, MATIC
- Y cualquier otro disponible en CoinGecko

### 2. Twelve Data (Acciones)
- **API:** https://api.twelvedata.com
- **Tipo:** Requiere API key (plan gratuito: 800 requests/día)
- **Datos proporcionados:**
  - Nombre completo de la empresa
  - Precio de cierre actual
  
**Configuración:**
```bash

**Obtener API key:**
1. Ir a https://twelvedata.com/
2. Registrarse (plan gratuito disponible)
3. Obtener API key desde el dashboard

### 3. ExchangeRate API (Divisas/Forex)
- **API:** https://api.exchangerate-api.com
- **Tipo:** Gratuita, sin API key necesaria (1500 requests/mes)
- **Datos proporcionados:**
  - Tasas de cambio en tiempo real
  - Soporte para todas las monedas principales
  
**Pares soportados:**
- EUR/USD, USD/EUR, GBP/USD, JPY/USD, etc.
- Cualquier combinación de monedas ISO 4217

### Creación automática de assets

Cuando se crea un asset con solo `ticker` y `type`, el sistema automáticamente:
1. Consulta la API externa correspondiente (con timeout de 10 s)
2. Obtiene el nombre y el precio actual
3. Guarda los datos en la base de datos

```javascript
// Crear asset automáticamente
await createAsset({
  ticker: 'BTC',
  type: 'CRYPTO'
});
// El sistema obtiene automáticamente: name, currentPrice
```

## Manejo de Errores

- **Al crear un asset** (`fetchAssetData`): si la API falla o el ticker no se encuentra se usan valores por defecto (`name` = ticker, `currentPrice` = 0) y la aplicación continúa.
- **Al refrescar precios** (`fetchAssetPrice`, `fetchStockPrices`, `fetchCryptoPrices`): un fallo o un precio no válido (0, vacío) se reporta como error y **se conserva el precio anterior** en la base de datos. Nunca se escribe un 0 por un fallo del proveedor.

## Limitaciones

### CoinGecko (gratuito)
- Sin límite de requests en plan gratuito
- Sin autenticación requerida
- Respuesta puede ser más lenta en horas pico

### Twelve Data (gratuito)
- 800 requests por día
- 8 requests por minuto
- Sin datos históricos en plan gratuito
- Logos no disponibles en plan gratuita