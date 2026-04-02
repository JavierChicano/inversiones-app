CREATE TABLE `staking_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`asset_ticker` text NOT NULL,
	`amount_staked` real NOT NULL,
	`manual_apy` real NOT NULL,
	`lock_period_days` integer DEFAULT 0,
	`start_date` integer NOT NULL,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` integer DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `fk_staking_positions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_staking_positions_asset_ticker_assets_ticker_fk` FOREIGN KEY (`asset_ticker`) REFERENCES `assets`(`ticker`)
);
