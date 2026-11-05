import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
// Migraciones: carpetas en ./drizzle con migration.sql (ver README). Aplicar con `npx drizzle-kit migrate`.

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
}, (table) => [
  index('transactions_user_id_idx').on(table.userId),
  index('transactions_user_date_idx').on(table.userId, table.date),
  index('transactions_asset_ticker_idx').on(table.assetTicker),
]);

// 4. PORTFOLIO SNAPSHOTS: Histórico para el gráfico de "Progresión"
export const portfolioSnapshots = sqliteTable('portfolio_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  
  totalInvested: real('total_invested').notNull(), // Cuánto dinero ha puesto de su bolsillo
  totalValue: real('total_value').notNull(), // Cuánto vale su cartera ese día
}, (table) => [
  index('portfolio_snapshots_user_date_idx').on(table.userId, table.date),
]);

// 5. WATCHLIST: Assets que el usuario quiere seguir pero no ha comprado
export const watchlist = sqliteTable('watchlist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  assetTicker: text('asset_ticker').references(() => assets.ticker).notNull(),
  
  targetPrice: real('target_price'), // Precio objetivo para alertas
  notes: text('notes'), // Notas personales del usuario
  
  addedAt: integer('added_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
  index('watchlist_user_id_idx').on(table.userId),
  index('watchlist_asset_ticker_idx').on(table.assetTicker),
]);

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
}, (table) => [
  index('currency_exchanges_user_date_idx').on(table.userId, table.date),
]);

// 7. STAKING POSITIONS: Control de activos en staking
export const stakingPositions = sqliteTable('staking_positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  assetTicker: text('asset_ticker').references(() => assets.ticker).notNull(),
  
  amountStaked: real('amount_staked').notNull(), // Cantidad de tokens bloqueados
  manualApy: real('manual_apy').notNull(), // El APY que metes a mano (ej. 6.92)
  lockPeriodDays: integer('lock_period_days').default(0), // Días que tarda en liberarse (ej. 3)
  
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(), // Cuándo empezaste a hacer staking
  lastAccrualAt: integer('last_accrual_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
  pendingRewardAmount: real('pending_reward_amount').default(0),
  totalClaimedReward: real('total_claimed_reward').default(0),
  status: text('status').default('ACTIVE'),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
  index('staking_positions_user_ticker_idx').on(table.userId, table.assetTicker),
]);

// 8. STAKING EVENTS: Historial de altas, retiradas y recompensas
export const stakingEvents = sqliteTable('staking_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  stakingPositionId: integer('staking_position_id').references(() => stakingPositions.id),
  assetTicker: text('asset_ticker').references(() => assets.ticker).notNull(),

  eventType: text('event_type').notNull(), // 'STAKE', 'UNSTAKE' o 'CLOSE'
  principalAmount: real('principal_amount').notNull(),
  rewardAmount: real('reward_amount').default(0),
  realizedApy: real('realized_apy').default(0),
  stakedDays: integer('staked_days').default(0),
  principalBefore: real('principal_before').default(0),
  principalDelta: real('principal_delta').default(0),
  principalAfter: real('principal_after').default(0),
  rewardAccrued: real('reward_accrued').default(0),
  rewardClaimed: real('reward_claimed').default(0),
  pendingRewardAfter: real('pending_reward_after').default(0),
  periodStart: integer('period_start', { mode: 'timestamp' }),
  periodEnd: integer('period_end', { mode: 'timestamp' }),
  note: text('note'),

  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
  index('staking_events_user_created_idx').on(table.userId, table.createdAt),
  index('staking_events_position_idx').on(table.stakingPositionId),
]);

// 9. PORTFOLIO REPORTS: Informes HTML (radiografías de cartera) subidos por el usuario
export const portfolioReports = sqliteTable('portfolio_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),

  title: text('title').notNull(), // Nombre visible del informe
  periodStart: text('period_start').notNull(), // Mes inicial del periodo analizado, formato 'YYYY-MM'
  periodEnd: text('period_end').notNull(), // Mes final del periodo analizado, formato 'YYYY-MM'

  html: text('html').notNull(), // Contenido HTML autocontenido del informe
  sizeBytes: integer('size_bytes').default(0), // Tamaño del HTML en bytes
  notes: text('notes'), // Notas y apuntes del usuario sobre el informe (texto libre)

  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
  index('portfolio_reports_user_id_idx').on(table.userId),
]);

// 10. LEVERAGED POSITIONS: Operativa apalancada (CFD / margen). Una fila por posición, abierta o cerrada.
export const leveragedPositions = sqliteTable('leveraged_positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id).notNull(),
  assetTicker: text('asset_ticker').references(() => assets.ticker).notNull(),

  direction: text('direction').notNull(), // 'LONG' o 'SHORT'

  // Posición y capital (todo en USD)
  margin: real('margin').notNull(), // Garantía G: capital real desembolsado
  leverage: real('leverage').notNull(), // Multiplicador (x2, x5...)
  exposure: real('exposure').notNull(), // G x multiplicador
  entryPrice: real('entry_price').notNull(), // Precio de entrada por unidad
  quantity: real('quantity').notNull(), // Exposición / precio de entrada

  // Comisiones
  openFee: real('open_fee').default(0), // Comisión de apertura
  spread: real('spread').default(0), // Diferencial aplicado en la entrada (informativo)
  dailySwap: real('daily_swap').default(0), // Financiación nocturna por día

  // Gestión de riesgo
  stopLoss: real('stop_loss'),
  takeProfit: real('take_profit'),
  notes: text('notes'),

  openedAt: integer('opened_at', { mode: 'timestamp' }).notNull(),
  status: text('status').default('OPEN'), // 'OPEN' o 'CLOSED'

  // Cierre (se rellenan al cerrar)
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  closePrice: real('close_price'),
  closeFee: real('close_fee').default(0),
  closeReason: text('close_reason'), // 'MANUAL', 'TAKE_PROFIT', 'STOP_LOSS', 'LIQUIDATION'
  daysHeld: integer('days_held').default(0),
  swapTotal: real('swap_total').default(0),
  totalFees: real('total_fees').default(0),
  grossPnl: real('gross_pnl').default(0),
  netPnl: real('net_pnl').default(0),
  roi: real('roi').default(0), // % sobre la garantía

  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
  index('leveraged_positions_user_status_idx').on(table.userId, table.status),
  index('leveraged_positions_asset_ticker_idx').on(table.assetTicker),
]);
