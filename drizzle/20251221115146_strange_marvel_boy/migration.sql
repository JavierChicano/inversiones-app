CREATE TABLE `assets` (
	`ticker` text PRIMARY KEY,
	`type` text NOT NULL,
	`name` text,
	`current_price` real DEFAULT 0,
	`last_updated` integer,
	`logo_url` text
);
--> statement-breakpoint
CREATE TABLE `portfolio_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`total_invested` real NOT NULL,
	`total_value` real NOT NULL,
	`cash_balance` real DEFAULT 0,
	CONSTRAINT `fk_portfolio_snapshots_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`asset_ticker` text NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`price_per_unit` real NOT NULL,
	`fees` real DEFAULT 0,
	`date` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `fk_transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_transactions_asset_ticker_assets_ticker_fk` FOREIGN KEY (`asset_ticker`) REFERENCES `assets`(`ticker`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`password` text NOT NULL,
	`name` text,
	`currency_preference` text DEFAULT 'USD',
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP)
);
