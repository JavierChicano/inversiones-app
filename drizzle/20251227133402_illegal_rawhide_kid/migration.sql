CREATE TABLE `watchlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`asset_ticker` text NOT NULL,
	`target_price` real,
	`notes` text,
	`added_at` integer DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `fk_watchlist_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_watchlist_asset_ticker_assets_ticker_fk` FOREIGN KEY (`asset_ticker`) REFERENCES `assets`(`ticker`)
);
