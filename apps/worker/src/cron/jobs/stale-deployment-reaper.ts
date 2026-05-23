import { reapStaleDeployments } from "../../lib/stale-deployment-reaper.js";
import type { CronJobDefinition } from "../types.js";

export const staleDeploymentReaperJob: CronJobDefinition = {
	name: "stale-deployment-reaper",
	pattern: "*/5 * * * *",
	handler: async () => {
		const result = await reapStaleDeployments();
		return { reaped: result.reaped };
	},
	description: "Fail deployments stuck in pending/in_progress for >30 minutes",
};
