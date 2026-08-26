CREATE TABLE IF NOT EXISTS `portfolio_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`html` text NOT NULL,
	`size_bytes` integer DEFAULT 0,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `fk_portfolio_reports_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `portfolio_reports_user_id_idx` ON `portfolio_reports` (`user_id`);
