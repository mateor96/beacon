import type { Worker } from "bullmq";
import { insertDlqWithRetry } from "../lib/dlq.js";
import { recordTerminalFailure } from "../lib/failure-alert.js";
import { createSystemLogger } from "../lib/logger.js";
import { PromiseTracker } from "../lib/promise-tracker.js";
import { processAgentsMd } from "../processors/agents-md.processor.js";
import { processAiVisibility } from "../processors/ai-visibility.processor.js";
import { processAnalysis } from "../processors/analysis.processor.js";
import { processCitationExtraction } from "../processors/citation-extraction.processor.js";
import { processCsvExport } from "../processors/csv-export.processor.js";
import { processDeploy } from "../processors/deploy.processor.js";
import { processEmail } from "../processors/email.processor.js";
import { processFix } from "../processors/fix.processor.js";
import { processJsonLd } from "../processors/json-ld.processor.js";
import { processLlmsTxt } from "../processors/llms-txt.processor.js";
import { processPublicAudit } from "../processors/public-audit.processor.js";
import { processReport } from "../processors/report.processor.js";
import { processRoiReport } from "../processors/roi-report.processor.js";
import { processRollback } from "../processors/rollback.processor.js";
import { processScan } from "../processors/scan.processor.js";
import { processValidateDeployment } from "../processors/validate-deployment.processor.js";
import { processWebhookDelivery } from "../processors/webhook-delivery.processor.js";
import { createWorker } from "./create-worker.js";

const log = createSystemLogger({ service: "worker", component: "workers" });

let workers: Worker[] = [];
let pendingDlqWrites: PromiseTracker;

export function startWorkers(): { workers: Worker[]; pendingDlqWrites: PromiseTracker } {
	pendingDlqWrites = new PromiseTracker();

	workers = [
		createWorker("scan", processScan),
		createWorker("fix", processFix),
		createWorker("report", processReport),
		createWorker("analysis", processAnalysis),
		createWorker("email", processEmail),
		createWorker("public-audit", processPublicAudit),
		createWorker("ai-visibility", processAiVisibility),
		createWorker("llms-txt", processLlmsTxt),
		createWorker("json-ld", processJsonLd),
		createWorker("agents-md", processAgentsMd),
		createWorker("roi-report", processRoiReport),
		createWorker("rollback", processRollback),
		createWorker("deploy", processDeploy),
		createWorker("validate-deployment", processValidateDeployment),
		createWorker("citation-extraction", processCitationExtraction),
		createWorker("csv-export", processCsvExport),
		createWorker("webhook-delivery", processWebhookDelivery),
	];

	for (const worker of workers) {
		worker.on("failed", (job, err) => {
			if (!job) return;

			const maxAttempts = job.opts.attempts ?? 1;
			const isTerminal = job.attemptsMade >= maxAttempts;

			if (isTerminal) {
				log.error("Job terminally failed", err, {
					queue: worker.name,
					jobId: job.id ?? "unknown",
					attemptsMade: job.attemptsMade,
				});

				const dlqPromise = insertDlqWithRetry({
					queue: worker.name,
					jobId: job.id ?? "unknown",
					jobData: job.data,
					errorMessage: err.message,
					errorStack: err.stack ?? null,
					attemptsMade: job.attemptsMade,
					maxAttempts,
				});
				pendingDlqWrites.track(dlqPromise);

				recordTerminalFailure({
					queue: worker.name,
					jobId: job.id ?? "unknown",
					error: err.message,
				});
			} else {
				log.error("Job failed (will retry)", err, {
					queue: worker.name,
					jobId: job.id ?? "unknown",
					attemptsMade: job.attemptsMade,
					maxAttempts,
				});
			}
		});
		worker.on("stalled", (jobId: string) => {
			log.warn("Job stalled — lock expired, will be retried", { queue: worker.name, jobId });
		});
		worker.on("error", (err) => {
			log.error("Worker error", err, { queue: worker.name });
		});
	}

	return { workers, pendingDlqWrites };
}

export async function stopWorkers(force = false): Promise<void> {
	if (workers.length === 0) return;
	await Promise.all(workers.map((w) => w.close(force)));
	workers = [];
}

export function getPendingDlqWrites(): PromiseTracker {
	return pendingDlqWrites;
}
