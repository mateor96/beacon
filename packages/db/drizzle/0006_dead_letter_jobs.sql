-- Dead letter jobs table for terminal failure capture
CREATE TABLE "dead_letter_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue" text NOT NULL,
	"job_id" text NOT NULL,
	"job_data" jsonb NOT NULL,
	"error_message" text NOT NULL,
	"error_stack" text,
	"attempts_made" integer NOT NULL,
	"max_attempts" integer NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dead_letter_jobs_queue_job_id_unique" UNIQUE("queue","job_id")
);
--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_queue_failed_at_idx" ON "dead_letter_jobs" USING btree ("queue","failed_at");--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_failed_at_idx" ON "dead_letter_jobs" USING btree ("failed_at");
