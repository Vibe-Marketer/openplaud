ALTER TABLE "recordings" ADD COLUMN "has_plaud_transcript" boolean DEFAULT false NOT NULL;
ALTER TABLE "recordings" ADD COLUMN "has_plaud_summary" boolean DEFAULT false NOT NULL;
ALTER TABLE "transcriptions" ADD COLUMN "plaud_segments" jsonb;
ALTER TABLE "transcriptions" ADD COLUMN "source" varchar(20) DEFAULT 'user' NOT NULL;
ALTER TABLE "ai_enhancements" ADD COLUMN "plaud_outline" jsonb;
ALTER TABLE "ai_enhancements" ADD COLUMN "source" varchar(20) DEFAULT 'user' NOT NULL;
