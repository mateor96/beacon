import { db, deadLetterJobQueries } from "@beacon/db";
import type { CronJobDefinition } from "../types.js";

const RETENTION_DAYS = 30;

export const dlqRetentionJob: CronJobDefinition = {
	name: "dlq-retention-cleanup",
	pattern: "0 3 * * *",
	handler: async () => {
		const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const deleted = await deadLetterJobQueries.deleteOlderThan(db, cutoff);
		return { deleted, retentionDays: RETENTION_DAYS };
	},
	description: "Delete DLQ entries older than 30 days",
};
