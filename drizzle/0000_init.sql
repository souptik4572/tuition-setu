CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`member_id` text,
	`task` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text,
	`input_chars` integer,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`duration_ms` integer NOT NULL,
	`ok` integer NOT NULL,
	`error_code` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_runs_workspace_created` ON `ai_runs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`student_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`entry_id` text,
	`label` text NOT NULL,
	`scored` real NOT NULL,
	`max` real NOT NULL,
	`taken_on` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `extracted_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assessments_student_taken` ON `assessments` (`student_id`,`taken_on`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_member_id` text,
	`action` text NOT NULL,
	`target_table` text,
	`target_id` text,
	`meta_json` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`label` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cycles_one_open` ON `cycles` (`workspace_id`) WHERE status <> 'completed';--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`student_id` text NOT NULL,
	`version` integer NOT NULL,
	`language` text NOT NULL,
	`facts_json` text,
	`body_model` text DEFAULT '' NOT NULL,
	`body_final` text,
	`message_final` text DEFAULT '' NOT NULL,
	`model` text,
	`prompt_version` text,
	`guard_json` text,
	`override` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`created_by` text,
	`approved_by` text,
	`sent_by` text,
	`approved_at` text,
	`sent_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_cycle_student_version` ON `drafts` (`cycle_id`,`student_id`,`version`);--> statement-breakpoint
CREATE TABLE `extracted_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`note_input_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`name_as_written` text NOT NULL,
	`student_id` text,
	`resolution` text NOT NULL,
	`payload_json` text NOT NULL,
	`flags_json` text NOT NULL,
	`confirmed_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_input_id`) REFERENCES `note_inputs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `extracted_entries_cycle_student` ON `extracted_entries` (`cycle_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`signature` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`pin_hash` text,
	`pin_salt` text,
	`pin_kind` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_workspace_user` ON `members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `members_user_workspace` ON `members` (`user_id`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `note_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`source` text NOT NULL,
	`origin` text DEFAULT 'capture' NOT NULL,
	`class_date` text NOT NULL,
	`batch` text,
	`raw_text` text,
	`transcript_draft_json` text,
	`image_path` text,
	`status` text DEFAULT 'captured' NOT NULL,
	`error_code` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `cycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_inputs_cycle_status` ON `note_inputs` (`cycle_id`,`status`);--> statement-breakpoint
CREATE TABLE `pairing_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pairing_tokens_token_hash_unique` ON `pairing_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`member_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`device_label` text NOT NULL,
	`user_agent` text,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`workspace_id` text NOT NULL,
	`full_name` text NOT NULL,
	`message_name` text NOT NULL,
	`name_native` text,
	`aliases_json` text NOT NULL,
	`class_grade` text NOT NULL,
	`batch` text,
	`subjects_json` text NOT NULL,
	`parent_name` text,
	`parent_phone` text NOT NULL,
	`parent_language` text NOT NULL,
	`standing_notes` text,
	`fees_pending` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `students_workspace_status` ON `students` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`subjects_json` text NOT NULL,
	`default_language` text DEFAULT 'en' NOT NULL,
	`tone` text DEFAULT 'warm' NOT NULL,
	`report_day` integer DEFAULT 0 NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`include_fee_reminders` integer DEFAULT false NOT NULL,
	`delete_photos_after_confirm` integer DEFAULT true NOT NULL,
	`ai_config_json` text NOT NULL,
	`last_backup_at` text
);
