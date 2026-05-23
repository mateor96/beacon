import type { EmailJobData, EmailJobResult } from "@beacon/queue";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

export async function processEmail(
	job: Job<EmailJobData, EmailJobResult>,
): Promise<EmailJobResult> {
	const log = createJobLogger({ queue: "email", jobId: job.id ?? "unknown", scanId: "" });
	const { emailLogId, to, from, subject, html, text, headers, tags } = job.data;

	log.info("Processing email", { to: to.join(", "), subject });

	// 1. Create provider based on environment
	const { createProvider } = await import("@beacon/notifications");
	const provider = createProvider();

	// 2. Send via provider
	const result = await provider.send({ from, to, subject, html, text, headers, tags });

	// 3. Update email_log to "sent"
	const { db, emailQueries } = await import("@beacon/db");
	await emailQueries.updateEmailLogStatus(db, emailLogId, {
		status: "sent",
		sentAt: new Date(),
		providerMessageId: result.messageId,
	});

	log.info("Email sent", { messageId: result.messageId, provider: result.provider });

	return { emailLogId, providerMessageId: result.messageId };
}
