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
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // Si false, no se actualiza en el cron job
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
});

// 5. WATCHLIST: Assets que el usuario quiere seguir pero no ha comprado
export const watchlist = sqliteTable('watchlist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  assetTicker: text('asset_ticker').references(() => assets.ticker).notNull(),
  
  targetPrice: real('target_price'), // Precio objetivo para alertas
  notes: text('notes'), // Notas personales del usuario
  
  addedAt: integer('added_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
});

// 6. CURRENCY_EXCHANGES: Operaciones de cambio de divisas (EUR-USD)
export const currencyExchanges = sqliteTable('currency_exchanges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  
  fromCurrency: text('from_currency').notNull(), // 'EUR' o 'USD'
  toCurrency: text('to_currency').notNull(), // 'USD' o 'EUR'
  
  amount: real('amount').notNull(), // Cantidad de dinero que se cambió
  exchangeRate: real('exchange_rate').notNull(), // Tipo de cambio en ese momento
  
  date: integer('date', { mode: 'timestamp' }).notNull(), // Fecha del cambio
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
});

// 7. STAKING POSITIONS: Control de activos en staking
export const stakingPositions = sqliteTable('staking_positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  assetTicker: text('asset_ticker').references(() => assets.ticker).notNull(),
  
  amountStaked: real('amount_staked').notNull(), // Cantidad de tokens bloqueados
  manualApy: real('manual_apy').notNull(), // El APY que metes a mano (ej. 6.92)
  lockPeriodDays: integer('lock_period_days').default(0), // Días que tarda en liberarse (ej. 3)
  
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(), // Cuándo empezaste a hacer staking
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
});

// 8. STAKING EVENTS: Historial de altas, retiradas y recompensas
export const stakingEvents = sqliteTable('staking_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  stakingPositionId: integer('staking_position_id').references(() => stakingPositions.id),
  assetTicker: text('asset_ticker').references(() => assets.ticker).notNull(),

  eventType: text('event_type').notNull(), // 'STAKE' o 'UNSTAKE'
  principalAmount: real('principal_amount').notNull(),
  rewardAmount: real('reward_amount').default(0),
  realizedApy: real('realized_apy').default(0),
  stakedDays: integer('staked_days').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
});