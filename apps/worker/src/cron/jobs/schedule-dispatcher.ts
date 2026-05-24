import { db, monitoringQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { createSystemLogger } from "../../lib/logger.js";
import type { CronJobDefinition } from "../types.js";

const log = createSystemLogger({ service: "worker", component: "cron:schedule-dispatcher" });

const FREQUENCY_MS: Record<string, number> = {
	hourly: 60 * 60 * 1000,
	daily: 24 * 60 * 60 * 1000,
	weekly: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Runs every hour and enqueues an AI-visibility sweep for each monitoring
 * schedule that is due (`nextRunAt <= now`, enabled), then advances its
 * `nextRunAt` by the schedule frequency. The jobId is per scheduled run so
 * sub-daily (hourly) schedules aren't deduped. Projects with an enabled
 * schedule are skipped by the daily blanket sweep, so a schedule effectively
 * overrides the default cadence for its project.
 */
export const scheduleDispatcherJob: CronJobDefinition = {
	name: "schedule-dispatcher",
	pattern: "@hourly",
	handler: async (): Promise<Record<string, unknown>> => {
		const now = new Date();
		const due = await monitoringQueries.getNextSchedules(db, now);
		let enqueued = 0;

		for (const schedule of due) {
			const project = schedule.project;
			const primary = project?.brandKeywords?.[0];
			if (!project || !primary) continue;
			try {
				await addJob(
					"ai-visibility",
					{ projectId: project.id, brandName: primary, queryText: `Was ist ${primary}?` },
					// Underscore-separated: BullMQ rejects job IDs with 3+ colons.
					{ jobId: `ai-vis_sched_${project.id}_${schedule.nextRunAt.getTime()}` },
				);
				const stepMs = FREQUENCY_MS[schedule.frequency] ?? FREQUENCY_MS.daily;
				await monitoringQueries.updateScheduleAfterRun(
					db,
					schedule.id,
					new Date(now.getTime() + stepMs),
				);
				enqueued += 1;
			} catch (err) {
				log.error("Failed to dispatch schedule", err, { scheduleId: schedule.id });
			}
		}

		return { due: due.length, enqueued };
	},
	description: "Hourly: enqueues AI-visibility sweeps for due monitoring schedules",
};
