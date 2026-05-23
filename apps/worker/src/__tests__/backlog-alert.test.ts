import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetQueueMetrics } = vi.hoisted(() => ({
	mockGetQueueMetrics: vi.fn(),
}));

vi.mock("@beacon/queue", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@beacon/queue")>();
	return {
		...actual,
		getQueueMetrics: mockGetQueueMetrics,
	};
});

import { _resetCooldowns, checkQueueBacklogs } from "../lib/backlog-alert";

function makeMetrics(queues: Array<{ name: string; waiting: number }>) {
	return {
		queues: queues.map((q) => ({
			name: q.name,
			counts: { waiting: q.waiting, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
			error: false,
		})),
		collectedAt: new Date().toISOString(),
		partial: false,
	};
}

describe("checkQueueBacklogs", () => {
	let stderrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		_resetCooldowns();
		stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
	});

	afterEach(() => {
		stderrSpy.mockRestore();
	});

	it("does not alert when all queues are below threshold", async () => {
		mockGetQueueMetrics.mockResolvedValue(
			makeMetrics([
				{ name: "scan", waiting: 10 },
				{ name: "fix", waiting: 50 },
			]),
		);

		const result = await checkQueueBacklogs();

		expect(result.checked).toBe(2);
		expect(result.alerted).toEqual([]);
		expect(stderrSpy).not.toHaveBeenCalled();
	});

	it("alerts when a queue exceeds the threshold", async () => {
		mockGetQueueMetrics.mockResolvedValue(
			makeMetrics([
				{ name: "scan", waiting: 200 },
				{ name: "fix", waiting: 10 },
			]),
		);

		const result = await checkQueueBacklogs();

		expect(result.checked).toBe(2);
		expect(result.alerted).toEqual(["scan"]);
		expect(stderrSpy).toHaveBeenCalledOnce();
		const written = stderrSpy.mock.calls[0][0] as string;
		const parsed = JSON.parse(written);
		expect(parsed.level).toBe("alert");
		expect(parsed.queue).toBe("scan");
		expect(parsed.waiting).toBe(200);
	});

	it("cooldown prevents repeated alerts within 10 minutes", async () => {
		mockGetQueueMetrics.mockResolvedValue(makeMetrics([{ name: "scan", waiting: 200 }]));

		const first = await checkQueueBacklogs();
		expect(first.alerted).toEqual(["scan"]);

		// Second call within cooldown window
		const second = await checkQueueBacklogs();
		expect(second.alerted).toEqual([]);
		expect(stderrSpy).toHaveBeenCalledTimes(1); // Only the first alert
	});
});
