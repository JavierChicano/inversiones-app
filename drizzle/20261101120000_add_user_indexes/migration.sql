CREATE INDEX IF NOT EXISTS `transactions_user_id_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_user_date_idx` ON `transactions` (`user_id`, `date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_asset_ticker_idx` ON `transactions` (`asset_ticker`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `portfolio_snapshots_user_date_idx` ON `portfolio_snapshots` (`user_id`, `date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `watchlist_user_id_idx` ON `watchlist` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `watchlist_asset_ticker_idx` ON `watchlist` (`asset_ticker`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `currency_exchanges_user_date_idx` ON `currency_exchanges` (`user_id`, `date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `staking_positions_user_ticker_idx` ON `staking_positions` (`user_id`, `asset_ticker`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `staking_events_user_created_idx` ON `staking_events` (`user_id`, `created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `staking_events_position_idx` ON `staking_events` (`staking_position_id`);
