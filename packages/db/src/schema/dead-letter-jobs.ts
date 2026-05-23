import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const deadLetterJobs = pgTable(
	"dead_letter_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		queue: text("queue").notNull(),
		jobId: text("job_id").notNull(),
		jobData: jsonb("job_data").notNull(),
		errorMessage: text("error_message").notNull(),
		errorStack: text("error_stack"),
		attemptsMade: integer("attempts_made").notNull(),
		maxAttempts: integer("max_attempts").notNull(),
		failedAt: timestamp("failed_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique("dead_letter_jobs_queue_job_id_unique").on(table.queue, table.jobId),
		index("dead_letter_jobs_queue_failed_at_idx").on(table.queue, table.failedAt),
		index("dead_letter_jobs_failed_at_idx").on(table.failedAt),
	],
);
