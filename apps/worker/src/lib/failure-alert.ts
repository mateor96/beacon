import { config } from "../config.js";

interface FailureAlertConfig {
	threshold: number;
	windowMs: number;
	cooldownMs: number;
}

interface FailureEvent {
	queue: string;
	jobId: string;
	error: string;
}

interface QueueState {
	timestamps: number[];
	lastAlertAt: number;
}

const state = new Map<string, QueueState>();

function getDefaultConfig(): FailureAlertConfig {
	return {
		threshold: config.alert.failureThreshold,
		windowMs: config.alert.failureWindowMs,
		cooldownMs: config.alert.failureCooldownMs,
	};
}

/**
 * Record a terminal failure and emit a structured alert if the
 * sliding-window threshold is breached and cooldown has elapsed.
 */
export function recordTerminalFailure(
	event: FailureEvent,
	overrides?: Partial<FailureAlertConfig>,
): void {
	const cfg = { ...getDefaultConfig(), ...overrides };
	const now = Date.now();

	let queueState = state.get(event.queue);
	if (!queueState) {
		queueState = { timestamps: [], lastAlertAt: 0 };
		state.set(event.queue, queueState);
	}

	queueState.timestamps.push(now);

	// Prune timestamps outside the window
	const cutoff = now - cfg.windowMs;
	queueState.timestamps = queueState.timestamps.filter((t) => t > cutoff);

	if (queueState.timestamps.length >= cfg.threshold) {
		const cooldownElapsed = now - queueState.lastAlertAt >= cfg.cooldownMs;
		if (cooldownElapsed) {
			queueState.lastAlertAt = now;
			const alert = JSON.stringify({
				level: "alert",
				type: "terminal_failure_threshold",
				queue: event.queue,
				count: queueState.timestamps.length,
				threshold: cfg.threshold,
				windowMs: cfg.windowMs,
				lastJobId: event.jobId,
				lastError: event.error,
				timestamp: new Date(now).toISOString(),
			});
			process.stderr.write(`${alert}\n`);
		}
	}
}

/** Reset all state — for testing only. */
export function resetAlertState(): void {
	state.clear();
}
