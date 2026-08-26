Genera el "Informe Radiografía de Cartera" para un usuario de mi app de inversiones.

USUARIO OBJETIVO: [email o id del usuario; si no indico nada, usa el único/primer usuario de la tabla users]

DE DÓNDE SALEN LOS DATOS
- Este repo (inversiones-app) es una app Next.js cuyos datos viven en una base de datos
  Turso remota. Credenciales en `.env` (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN).
- Esquema en `lib/db/schema.js`: users, assets, transactions, portfolio_snapshots,
  watchlist, currency_exchanges, staking_positions, staking_events.
- Extrae los datos con un script Node usando @libsql/client + dotenv, ejecutado desde la
  raíz del proyecto (desde fuera falla la resolución de node_modules). Filtra todas las
  tablas por el user_id del usuario objetivo.
- Precauciones de interpretación: en assets, is_active=false significa precio congelado
  (anota su fecha last_updated); en portfolio_snapshots, total_invested es el coste base
  de las posiciones abiertas, NO la aportación acumulada de bolsillo; las compras con
  precio 0 suelen ser recompensas de staking reclamadas.

QUÉ ANALIZAR (mínimo)
1. P&L por activo con método de coste medio: realizado en ventas, latente en cartera,
   comisiones, y el total por activo.
2. Historial de ventas completo: win rate, ganancia media por venta, y "qué hizo el precio
   después de cada última venta" (aciertos de salida vs ganancias dejadas de correr).
3. Flujos de divisa EUR↔USD: aportado neto real en EUR, tipo medio de cambio, impacto
   divisa, liquidez USD estimada por diferencia de flujos.
4. Resultado global EN EUROS (aportado neto vs valor actual convertido) — es el número
   principal del informe, no el P&L en USD. Los beneficios reinvertidos no cuentan como
   aportación: solo el dinero que salió del bolsillo menos el ya retirado.
5. Evolución diaria de coste base vs valor (snapshots): máximo drawdown, mejor/peor día,
   tabla por fin de mes.
6. Aportación mensual neta: disciplina, media, y si el ritmo se acelera al estar en pérdidas.
7. Cartera actual: posiciones, precios medios vs actuales, concentración por activo y por
   tipo (cripto/acciones), staking (APY, recompensas generadas).
8. Análisis de comportamiento: efecto disposición (cortar ganadoras vs aguantar perdedoras),
   promedios a la baja, tamaño de entradas, rotación (nº operaciones vs resultado),
   existencia o no de reglas de salida consistentes.
9. Añade cualquier otra métrica que los datos permitan y sea relevante: periodos medios de
   tenencia, racha de mejores/peores meses, dependencia de un solo activo, coste de
   oportunidad de ventas tempranas, calidad del timing de compra (precio de compra vs rango
   posterior), etc.

QUÉ ENTREGAR
- Un informe en español, detallado y con veredicto honesto: diagnóstico en una frase,
  gráficos (evolución, flujos mensuales, asignación, P&L por activo), tablas (cartera,
  ventas una a una, qué pasó tras vender), puntos fuertes, puntos débiles, recomendaciones
  numeradas y accionables, veredicto final y nota metodológica.
- Incluye una sección "Dinero que entra, dinero que sale": total enviado a invertir vs
  total retirado de vuelta (con tabla detallando cada retirada: fecha, importe, tipo de
  cambio y euros recibidos), el aportado neto resultante y qué % de lo enviado ya está
  recuperado.
- Incluye al final una sección "Glosario" que explique en una línea, en lenguaje llano,
  cada sigla y término técnico usado en el informe (P&L, P&L realizado vs latente, coste
  base, precio medio, aportado neto, win rate, drawdown, APY, staking, swing trading,
  promediar a la baja, efecto disposición, stop-loss, liquidez, indexado, y cualquier otro
  que aparezca).
- Formato: UN archivo HTML autocontenido (sin recursos externos, tema claro y oscuro,
  gráficos SVG con tooltips) Y un PDF generado localmente desde ese HTML con Edge headless
  (--print-to-pdf, versión clara, con estilos de impresión para que no se corten gráficos).
- Guarda ambos en C:\Users\javiC\Desktop\ como radiografia-cartera.html y
  radiografia-cartera.pdf (si indico otra ruta u otro nombre, usa esos).

PRIVACIDAD (obligatorio)
- TODO se genera en local. NO publiques nada como Artifact ni en ningún servicio externo;
  no subas datos a la nube bajo ningún concepto.
- Al terminar, borra todos los archivos temporales que contengan datos financieros
  (volcados de la BD, series intermedias, scripts de extracción, copias del HTML fuera
  del destino final).