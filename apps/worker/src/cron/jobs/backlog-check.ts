import { checkQueueBacklogs } from "../../lib/backlog-alert.js";
import type { CronJobDefinition } from "../types.js";

export const backlogCheckJob: CronJobDefinition = {
	name: "backlog-check",
	pattern: "*/5 * * * *",
	handler: async () => {
		const result = await checkQueueBacklogs();
		return { checked: result.checked, alerted: result.alerted };
	},
	description: "Check queue backlogs and emit alerts for thresholds exceeded",
};
