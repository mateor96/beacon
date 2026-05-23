import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
	config: {
		redis: { host: "localhost", port: 6379, password: "test" },
		worker: { port: 3001 },
		alert: {
			failureThreshold: 5,
			failureWindowMs: 600_000,
			failureCooldownMs: 600_000,
		},
	},
}));

import { recordTerminalFailure, resetAlertState } from "../lib/failure-alert.js";

describe("failure-alert", () => {
	let stderrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.useFakeTimers();
		resetAlertState();
		stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
	});

	afterEach(() => {
		vi.useRealTimers();
		stderrSpy.mockRestore();
	});

	it("does not emit alert below threshold", () => {
		for (let i = 0; i < 4; i++) {
			recordTerminalFailure({ queue: "scan", jobId: `job-${i}`, error: "fail" });
		}
		expect(stderrSpy).not.toHaveBeenCalled();
	});

	it("emits structured alert at threshold", () => {
		for (let i = 0; i < 5; i++) {
			recordTerminalFailure({ queue: "scan", jobId: `job-${i}`, error: "timeout" });
		}
		expect(stderrSpy).toHaveBeenCalledTimes(1);
		const output = (stderrSpy.mock.calls[0] as unknown[])[0] as string;
		const parsed = JSON.parse(output.trim());
		expect(parsed.level).toBe("alert");
		expect(parsed.type).toBe("terminal_failure_threshold");
		expect(parsed.queue).toBe("scan");
		expect(parsed.count).toBe(5);
	});

	it("respects cooldown — no duplicate alerts within cooldown window", () => {
		for (let i = 0; i < 5; i++) {
			recordTerminalFailure({ queue: "scan", jobId: `job-${i}`, error: "fail" });
		}
		expect(stderrSpy).toHaveBeenCalledTimes(1);

		// Additional failures within cooldown should not trigger another alert
		for (let i = 5; i < 10; i++) {
			recordTerminalFailure({ queue: "scan", jobId: `job-${i}`, error: "fail" });
		}
		expect(stderrSpy).toHaveBeenCalledTimes(1);

		// After cooldown elapses, need threshold failures again (old ones expired from window)
		vi.advanceTimersByTime(600_001);
		for (let i = 10; i < 15; i++) {
			recordTerminalFailure({ queue: "scan", jobId: `job-${i}`, error: "fail" });
		}
		expect(stderrSpy).toHaveBeenCalledTimes(2);
	});

	it("tracks queues independently", () => {
		for (let i = 0; i < 5; i++) {
			recordTerminalFailure({ queue: "scan", jobId: `scan-${i}`, error: "fail" });
		}
		expect(stderrSpy).toHaveBeenCalledTimes(1);

		// Fix queue is separate — 4 failures should not trigger
		for (let i = 0; i < 4; i++) {
			recordTerminalFailure({ queue: "fix", jobId: `fix-${i}`, error: "fail" });
		}
		expect(stderrSpy).toHaveBeenCalledTimes(1); // still just the scan alert

		// 5th fix failure triggers
		recordTerminalFailure({ queue: "fix", jobId: "fix-4", error: "fail" });
		expect(stderrSpy).toHaveBeenCalledTimes(2);
	});

	it("resetAlertState clears all counters", () => {
		for (let i = 0; i < 4; i++) {
			recordTerminalFailure({ queue: "scan", jobId: `job-${i}`, error: "fail" });
		}
		resetAlertState();

		// After reset, need full threshold again
		recordTerminalFailure({ queue: "scan", jobId: "job-new", error: "fail" });
		expect(stderrSpy).not.toHaveBeenCalled();
	});
});
