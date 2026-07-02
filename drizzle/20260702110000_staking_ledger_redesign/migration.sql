PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `staking_positions` ADD COLUMN `last_accrual_at` integer;--> statement-breakpoint
ALTER TABLE `staking_positions` ADD COLUMN `pending_reward_amount` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `staking_positions` ADD COLUMN `total_claimed_reward` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `staking_positions` ADD COLUMN `status` text DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE `staking_positions` ADD COLUMN `closed_at` integer;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `principal_before` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `principal_delta` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `principal_after` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `reward_accrued` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `reward_claimed` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `pending_reward_after` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `period_start` integer;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `period_end` integer;--> statement-breakpoint
ALTER TABLE `staking_events` ADD COLUMN `note` text;--> statement-breakpoint
UPDATE `staking_positions`
SET
  `pending_reward_amount` = COALESCE(`pending_reward_amount`, 0),
  `total_claimed_reward` = COALESCE(`total_claimed_reward`, 0),
  `status` = COALESCE(`status`, 'ACTIVE'),
  `last_accrual_at` = COALESCE(`last_accrual_at`, `start_date`)
WHERE 1=1;--> statement-breakpoint
UPDATE `staking_events`
SET
  `principal_before` = COALESCE(`principal_before`, 0),
  `principal_delta` = COALESCE(`principal_delta`, `principal_amount`),
  `principal_after` = COALESCE(`principal_after`, 0),
  `reward_accrued` = COALESCE(`reward_accrued`, `reward_amount`),
  `reward_claimed` = COALESCE(`reward_claimed`, 0),
  `pending_reward_after` = COALESCE(`pending_reward_after`, 0)
WHERE 1=1;--> statement-breakpoint
PRAGMA foreign_keys=ON;