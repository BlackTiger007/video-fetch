CREATE TABLE
	`downloads` (
		`id` text PRIMARY KEY NOT NULL,
		`video_url` text NOT NULL,
		`file_name` text,
		`append_title` integer NOT NULL,
		`quality` text NOT NULL,
		`status` text NOT NULL,
		`error_message` text,
		`created_at` integer NOT NULL,
		`updated_at` integer NOT NULL,
		`finished_at` integer
	);

--> statement-breakpoint
CREATE UNIQUE INDEX `uq_downloads_video_url` ON `downloads` (`video_url`);
