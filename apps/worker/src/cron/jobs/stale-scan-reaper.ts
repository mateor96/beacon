import { reapStaleScans } from "../../lib/stale-scan-reaper.js";
import type { CronJobDefinition } from "../types.js";

export const staleScanReaperJob: CronJobDefinition = {
	name: "stale-scan-reaper",
	pattern: "*/5 * * * *",
	handler: async () => {
		const result = await reapStaleScans();
		return { reaped: result.reaped, compensated: result.compensated };
	},
	description: "Reap stale scans and rollback quotas",
};
