CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`token_hash` text NOT NULL,
	`revision` integer NOT NULL,
	`applied` integer NOT NULL,
	`seen` integer NOT NULL,
	`telemetry` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `commands` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`device_id` text NOT NULL,
	`actor` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`status` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `commands_client` ON `commands` (`client_id`,`status`,`expires`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`device` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_client_time` ON `events` (`client_id`,`at`);--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`version` text NOT NULL,
	`sha256` text NOT NULL,
	`signature` text NOT NULL,
	`size` integer NOT NULL,
	`created` integer NOT NULL,
	`status` text NOT NULL
);
