import { db, monitoringQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { createSystemLogger } from "../../lib/logger.js";
import type { CronJobDefinition } from "../types.js";

const log = createSystemLogger({ service: "worker", component: "cron:ai-visibility-sweep" });

/**
 * Daily sweep across all monitoring projects. For each project, enqueues
 * an `ai-visibility` job per brand keyword. The processor handles per-engine
 * fan-out and rate-limiting.
 *
 * Idempotent: if a project's first brand keyword already has an in-flight
 * job, the BullMQ jobId (`ai-vis:<projectId>:<YYYY-MM-DD>`) will dedupe.
 */
export const aiVisibilitySweepJob: CronJobDefinition = {
	name: "ai-visibility-sweep",
	pattern: "@daily",
	handler: async () => {
		const projects = await monitoringQueries.listAllProjects(db);
		let enqueued = 0;
		const today = new Date().toISOString().slice(0, 10);

		for (const project of projects) {
			const primary = project.brandKeywords[0];
			if (!primary) continue;
			try {
				await addJob(
					"ai-visibility",
					{
						projectId: project.id,
						brandName: primary,
						queryText: `Was ist ${primary}?`,
					},
					{ jobId: `ai-vis:${project.id}:${today}` },
				);
				enqueued += 1;
			} catch (err) {
				log.error("Failed to enqueue ai-visibility job", err, { projectId: project.id });
			}
		}

		return { projects: projects.length, enqueued };
	},
	description: "Daily AI-visibility sweep across all monitoring projects",
};
