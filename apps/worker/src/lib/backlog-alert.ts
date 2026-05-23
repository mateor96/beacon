import { getQueueMetrics } from "@beacon/queue";

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

const lastAlertTimes = new Map<string, number>();

function getThreshold(): number {
	const env = process.env.ALERT_BACKLOG_THRESHOLD;
	if (env) {
		const parsed = Number.parseInt(env, 10);
		if (!Number.isNaN(parsed) && parsed > 0) return parsed;
	}
	return 100;
}

export async function checkQueueBacklogs(): Promise<{
	checked: number;
	alerted: string[];
}> {
	const threshold = getThreshold();
	const metrics = await getQueueMetrics();
	const alerted: string[] = [];

	for (const queue of metrics.queues) {
		if (queue.counts.waiting <= threshold) continue;

		const lastAlert = lastAlertTimes.get(queue.name);
		const now = Date.now();
		if (lastAlert && now - lastAlert < COOLDOWN_MS) continue;

		lastAlertTimes.set(queue.name, now);
		alerted.push(queue.name);

		process.stderr.write(
			`${JSON.stringify({
				level: "alert",
				ts: now,
				service: "worker",
				component: "backlog-alert",
				message: "Queue backlog exceeds threshold",
				queue: queue.name,
				waiting: queue.counts.waiting,
				threshold,
			})}\n`,
		);
	}

	return { checked: metrics.queues.length, alerted };
}

/** Reset cooldown state (for testing). */
export function _resetCooldowns(): void {
	lastAlertTimes.clear();
}
