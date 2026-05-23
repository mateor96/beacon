import { db, deadLetterJobQueries } from "@beacon/db";
import { createSystemLogger } from "./logger.js";

const log = createSystemLogger({ service: "worker", component: "dlq" });

const DLQ_RETRY_ATTEMPTS = 2;
const DLQ_RETRY_DELAY_MS = 2_000;

/** Insert a DLQ entry with retry. On total failure, emit structured JSON to stderr. */
export async function insertDlqWithRetry(
	data: Parameters<typeof deadLetterJobQueries.insert>[1],
): Promise<void> {
	for (let attempt = 0; attempt <= DLQ_RETRY_ATTEMPTS; attempt++) {
		try {
			await deadLetterJobQueries.insert(db, data);
			return;
		} catch (err) {
			if (attempt < DLQ_RETRY_ATTEMPTS) {
				await new Promise((r) => setTimeout(r, DLQ_RETRY_DELAY_MS));
			} else {
				// All retries exhausted — structured stderr fallback so data is never lost
				const fallback = JSON.stringify({
					level: "critical",
					type: "dlq_persistence_failure",
					queue: data.queue,
					jobId: data.jobId,
					jobData: data.jobData,
					errorMessage: data.errorMessage,
					errorStack: data.errorStack,
					attemptsMade: data.attemptsMade,
					maxAttempts: data.maxAttempts,
					dbError: err instanceof Error ? err.message : String(err),
					timestamp: new Date().toISOString(),
				});
				process.stderr.write(`${fallback}\n`);
			}
		}
	}
}
