PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_staking_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`staking_position_id` integer,
	`asset_ticker` text NOT NULL,
	`event_type` text NOT NULL,
	`principal_amount` real NOT NULL,
	`reward_amount` real DEFAULT 0,
	`realized_apy` real DEFAULT 0,
	`staked_days` integer DEFAULT 0,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `fk_staking_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_staking_events_staking_position_id_staking_positions_id_fk` FOREIGN KEY (`staking_position_id`) REFERENCES `staking_positions`(`id`),
	CONSTRAINT `fk_staking_events_asset_ticker_assets_ticker_fk` FOREIGN KEY (`asset_ticker`) REFERENCES `assets`(`ticker`)
);
--> statement-breakpoint
INSERT INTO `__new_staking_events`(`id`, `user_id`, `staking_position_id`, `asset_ticker`, `event_type`, `principal_amount`, `reward_amount`, `realized_apy`, `staked_days`, `created_at`) SELECT `id`, `user_id`, `staking_position_id`, `asset_ticker`, `event_type`, `principal_amount`, `reward_amount`, `realized_apy`, `staked_days`, `created_at` FROM `staking_events`;--> statement-breakpoint
DROP TABLE `staking_events`;--> statement-breakpoint
ALTER TABLE `__new_staking_events` RENAME TO `staking_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;