import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAdd = vi.fn().mockResolvedValue({ id: "job-1", name: "scan" });
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => ({
	Queue: vi.fn().mockImplementation((name: string, opts: Record<string, unknown>) => ({
		name,
		opts,
		add: mockAdd,
		close: mockClose,
	})),
}));

import { Queue } from "bullmq";
import { addJob, closeAllQueues, getQueues } from "../client";

describe("addJob", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		closeAllQueues();
	});

	it("creates queue lazily and calls queue.add with correct args", async () => {
		const data = { scanId: "s1", url: "https://example.com" };
		await addJob("scan", data);

		expect(Queue).toHaveBeenCalledTimes(1);
		expect(mockAdd).toHaveBeenCalledWith("scan", data, undefined);
	});

	it("reuses existing queue on second call", async () => {
		await addJob("scan", { scanId: "s1", url: "https://a.com" });
		await addJob("scan", { scanId: "s2", url: "https://b.com" });

		expect(Queue).toHaveBeenCalledTimes(1);
		expect(mockAdd).toHaveBeenCalledTimes(2);
	});

	it("passes JobsOptions through", async () => {
		const opts = { priority: 1, delay: 5000 };
		await addJob("scan", { scanId: "s1", url: "https://example.com" }, opts);

		expect(mockAdd).toHaveBeenCalledWith("scan", expect.any(Object), opts);
	});

	it("creates separate queues for different names", async () => {
		await addJob("scan", { scanId: "s1", url: "https://example.com" });
		await addJob("fix", { scanId: "s1", checkIds: ["llms-txt"] });

		expect(Queue).toHaveBeenCalledTimes(2);
	});
});

describe("getQueues", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		closeAllQueues();
	});

	it("creates exactly 17 queues", () => {
		const queues = getQueues();
		expect(Object.keys(queues)).toHaveLength(17);
		expect(Object.keys(queues)).toEqual([
			"scan",
			"fix",
			"report",
			"analysis",
			"email",
			"public-audit",
			"ai-visibility",
			"llms-txt",
			"json-ld",
			"agents-md",
			"roi-report",
			"rollback",
			"deploy",
			"validate-deployment",
			"citation-extraction",
			"csv-export",
			"webhook-delivery",
		]);
	});

	it("each queue uses 'beacon' prefix", () => {
		getQueues();
		for (const call of (Queue as unknown as ReturnType<typeof vi.fn>).mock.calls) {
			expect(call[1].prefix).toBe("beacon");
		}
	});
});

describe("closeAllQueues", () => {
	beforeEach(async () => {
		await closeAllQueues();
		vi.clearAllMocks();
	});

	it("closes all initialized queues", async () => {
		await addJob("scan", { scanId: "s1", url: "https://example.com" });
		await addJob("fix", { scanId: "s1", checkIds: ["llms-txt"] });

		await closeAllQueues();
		expect(mockClose).toHaveBeenCalledTimes(2);
	});

	it("is a no-op when no queues are initialized", async () => {
		await closeAllQueues();
		expect(mockClose).not.toHaveBeenCalled();
	});

	it("fully resets registry so addJob after close creates fresh queue", async () => {
		await addJob("scan", { scanId: "s1", url: "https://example.com" });
		expect(Queue).toHaveBeenCalledTimes(1);

		await closeAllQueues();
		vi.clearAllMocks();

		await addJob("scan", { scanId: "s2", url: "https://example.com" });
		expect(Queue).toHaveBeenCalledTimes(1);
	});
});
