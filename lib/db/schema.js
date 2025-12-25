import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
//npx drizzle-kit generate  
//npx drizzle-kit migrate  

// 1. USERS: Gestión de usuarios y preferencias
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Recomiendo usar CUID o UUID
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Contraseña hasheada
  name: text('name'),
  currencyPreference: text('currency_preference').default('USD'), // USD o EUR
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
});

// 2. ASSETS: La tabla "Maestra" que actualiza el Cron Job
// El Cron Job consultará las APIs y actualizará 'currentPrice' y 'lastUpdated'.
export const assets = sqliteTable('assets', {
  ticker: text('ticker').primaryKey(), // Ej: BTC, AAPL, TTWO
  type: text('type').notNull(), // 'CRYPTO', 'STOCK', 'FIAT' (para tipo de cambio EUR/USD)
  name: text('name'), // Nombre completo (Bitcoin, Take-Two Interactive)
  currentPrice: real('current_price').default(0), // Precio actual en USD
  lastUpdated: integer('last_updated', { mode: 'timestamp' }), // Para saber si el dato es fresco
});

// 3. TRANSACTIONS: El registro de movimientos del usuario
export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  assetTicker: text('asset_ticker').references(() => assets.ticker).notNull(),
  
  type: text('type').notNull(), // 'BUY' o 'SELL'
  
  // Datos de la operación
  quantity: real('quantity').notNull(), // Cantidad de acciones o tokens
  pricePerUnit: real('price_per_unit').notNull(), // A cuánto compraste/vendiste cada unidad
  fees: real('fees').default(0), // Comisiones del broker
  
  date: integer('date', { mode: 'timestamp' }).notNull(), // Fecha de compra/venta
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
});

// 4. PORTFOLIO SNAPSHOTS: Histórico para el gráfico de "Progresión"
export const portfolioSnapshots = sqliteTable('portfolio_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  
  totalInvested: real('total_invested').notNull(), // Cuánto dinero ha puesto de su bolsillo
  totalValue: real('total_value').notNull(), // Cuánto vale su cartera ese día
  
  // Opcional: Desglose rápido para no recalcular
  cashBalance: real('cash_balance').default(0), // Si manejas liquidez
});