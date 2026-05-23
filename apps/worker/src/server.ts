import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { config } from "./config.js";
import { aiVisibilitySweepJob } from "./cron/jobs/ai-visibility-sweep.js";
import { backlogCheckJob } from "./cron/jobs/backlog-check.js";
import { dlqRetentionJob } from "./cron/jobs/dlq-retention.js";
import { redditDiscoveryJob } from "./cron/jobs/reddit-discovery.js";
import { staleDeploymentReaperJob } from "./cron/jobs/stale-deployment-reaper.js";
import { staleScanReaperJob } from "./cron/jobs/stale-scan-reaper.js";
import { CronRegistry } from "./cron/registry.js";
import { registerHealthRoute } from "./health.js";
import { createSystemLogger } from "./lib/logger.js";
import { closeAllQueues, getQueues } from "./queues/index.js";
import { startWorkers, stopWorkers } from "./workers/index.js";

const log = createSystemLogger({ service: "worker", component: "server" });

async function main() {
	const app = new Hono();

	let isShuttingDown = false;

	// Initialize
	getQueues();
	const { pendingDlqWrites } = startWorkers();

	const cronRegistry = new CronRegistry();
	cronRegistry.register(staleScanReaperJob);
	cronRegistry.register(staleDeploymentReaperJob);
	cronRegistry.register(dlqRetentionJob);
	cronRegistry.register(backlogCheckJob);
	cronRegistry.register(aiVisibilitySweepJob);
	cronRegistry.register(redditDiscoveryJob);
	await cronRegistry.start();

	registerHealthRoute(app, () => isShuttingDown, cronRegistry);

	log.info("Workers started for queues: scan, fix, report, analysis");

	const server = serve({ fetch: app.fetch, port: config.worker.port }, () => {
		log.info("Worker health server running", { port: config.worker.port });
	});

	async function shutdown(signal: string) {
		if (isShuttingDown) {
			log.info("Received signal again, forcing immediate exit", { signal });
			process.exit(1);
		}
		isShuttingDown = true;
		log.info("Starting graceful shutdown", { signal });

		// Safety net: force exit after timeout + 5s headroom
		const forceTimer = setTimeout(() => {
			log.error("Force exit timeout reached, killing process");
			process.exit(1);
		}, config.worker.shutdownTimeoutMs + 5_000);
		forceTimer.unref();

		try {
			// Phase 0: Stop periodic jobs
			await cronRegistry.stop();

			// Phase 1: Drain workers (wait for in-flight jobs to finish)
			log.info("Phase 1: Draining in-flight jobs");
			const drainResult = await Promise.race([
				stopWorkers(false).then(() => "drained" as const),
				new Promise<"timeout">((r) =>
					setTimeout(() => r("timeout"), config.worker.shutdownTimeoutMs),
				),
			]);

			if (drainResult === "timeout") {
				log.warn("Drain timeout reached, force-closing workers");
				await cronRegistry.stop(true);
				await stopWorkers(true);
			}

			// Phase 2: Wait for pending DLQ writes
			if (pendingDlqWrites.size > 0) {
				log.info("Phase 2: Waiting for pending DLQ writes", { count: pendingDlqWrites.size });
				const dlqResult = await pendingDlqWrites.waitAll(5_000);
				if (dlqResult.timedOut) {
					log.warn("DLQ write timeout reached, some writes may be lost");
				}
			}

			// Phase 3: Close connections
			await closeAllQueues();
			server.close();

			clearTimeout(forceTimer);
			log.info("Graceful shutdown complete");
			process.exit(0);
		} catch (err) {
			log.error("Error during shutdown", err);
			clearTimeout(forceTimer);
			process.exit(1);
		}
	}

	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
	log.error("Failed to start worker", err);
	process.exit(1);
});
