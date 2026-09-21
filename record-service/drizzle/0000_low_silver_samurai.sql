CREATE TABLE `completions` (
	`visit_id` text NOT NULL,
	`activity` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`answers_json` text NOT NULL,
	`writing_json` text NOT NULL,
	`completed_at` text NOT NULL,
	PRIMARY KEY(`visit_id`, `activity`),
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`created_at` text NOT NULL,
	`token_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visits_student_created` ON `visits` (`student_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_visits_created_id` ON `visits` (`created_at`,`id`);