ALTER TABLE "ai_enhancements" ADD COLUMN "plaud_outline" jsonb;--> statement-breakpoint
ALTER TABLE "ai_enhancements" ADD COLUMN "source" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "plaud_connections" ADD COLUMN "api_base" text DEFAULT 'https://api.plaud.ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "has_plaud_transcript" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "has_plaud_summary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transcriptions" ADD COLUMN "plaud_segments" jsonb;--> statement-breakpoint
ALTER TABLE "transcriptions" ADD COLUMN "source" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "auto_transcribe_provider" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "webhook_secret" text;