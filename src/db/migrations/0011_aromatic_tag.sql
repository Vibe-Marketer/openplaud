ALTER TABLE "ai_enhancements" ADD COLUMN IF NOT EXISTS "plaud_outline" jsonb;--> statement-breakpoint
ALTER TABLE "ai_enhancements" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "plaud_connections" ADD COLUMN IF NOT EXISTS "api_base" text DEFAULT 'https://api.plaud.ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "has_plaud_transcript" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "has_plaud_summary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transcriptions" ADD COLUMN IF NOT EXISTS "plaud_segments" jsonb;--> statement-breakpoint
ALTER TABLE "transcriptions" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "auto_transcribe_provider" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "webhook_url" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "webhook_secret" text;