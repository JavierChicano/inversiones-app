# API Endpoints - Estado Actual

## ✅ Endpoints Activos (9)

### Autenticación (3)
- `POST /api/auth/login` - Login de usuario
  - **Usado en**: AuthModal.js
- `POST /api/auth/register` - Registro de usuario
  - **Usado en**: AuthModal.js
- `GET /api/auth/verify` - Verificar token JWT
  - **Usado en**: AuthContext.js (verificación automática)

### Dashboard (1)
- `GET /api/dashboard/stats` - Obtener estadísticas completas del dashboard
  - **Usado en**: app/dashboard/page.js
  - **Retorna**: stats, stockDistribution, progression, exchangeRate

### Transacciones (3)
- `GET /api/transactions` - Listar transacciones del usuario
  - **Usado en**: TransactionsTable.js, transactions/page.js
- `POST /api/transactions` - Crear nueva transacción
  - **Usado en**: QuickAddTransaction.js
- `GET /api/transactions/[id]` - Obtener transacción específica
  - **Usado en**: TransactionsTable.js (editar)
- `PUT /api/transactions/[id]` - Actualizar transacción
  - **Usado en**: TransactionsTable.js (editar)
- `DELETE /api/transactions/[id]` - Eliminar transacción
  - **Usado en**: TransactionsTable.js (borrar)

### Assets (2)
- `GET /api/assets/[ticker]` - Obtener precio actual de un asset
  - **Usado en**: TransactionsTable.js (SellModal - obtener precio actual)
- `POST /api/assets/refresh-user` - Actualizar precios de assets del usuario
  - **Usado en**: DashboardNav.js (botón Actualizar)
- `POST /api/assets/refresh-all` - Actualizar todos los assets + guardar snapshots
  - **Usado en**: GitHub Actions (cron cada 20 min)

## 📁 Estructura Final

```
app/api/
├── auth/
│   ├── login/route.js
│   ├── register/route.js
│   └── verify/route.js
├── dashboard/
│   └── stats/route.js
├── transactions/
│   ├── route.js
│   └── [id]/route.js
└── assets/
    ├── [ticker]/route.js
    ├── refresh-user/route.js
    └── refresh-all/route.js
```

## 🔄 Flujo de Datos

1. **Usuario se autentica** → `/api/auth/login` o `/api/auth/register`
2. **Se verifica automáticamente** → `/api/auth/verify`
3. **Carga dashboard** → `/api/dashboard/stats` (incluye todo: stats, positions, progression, etc.)
4. **Crea transacción** → `POST /api/transactions`
5. **Actualiza precios manualmente** → `/api/assets/refresh-user` (botón)
6. **Cron actualiza automáticamente** → `/api/assets/refresh-all` (cada 20 min via GitHub Actions)

## 💡 Beneficios de la Limpieza

- ✅ **Menos endpoints** = código más fácil de mantener
- ✅ **Sin duplicación** = una sola fuente de verdad
- ✅ **Mejor rendimiento** = menos consultas innecesarias
- ✅ **Más claro** = flujo de datos simplificado
