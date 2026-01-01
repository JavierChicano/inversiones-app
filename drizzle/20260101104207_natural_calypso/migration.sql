CREATE TABLE `currency_exchanges` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`from_currency` text NOT NULL,
	`to_currency` text NOT NULL,
	`amount` real NOT NULL,
	`exchange_rate` real NOT NULL,
	`date` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `fk_currency_exchanges_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
