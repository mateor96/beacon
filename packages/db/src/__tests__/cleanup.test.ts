import { describe, expect, it, vi } from "vitest";
import {
	deleteExpiredScans,
	findExpiredHtmlContent,
	purgeExpiredHtmlContent,
	setExpiresAtForScans,
} from "../queries/cleanup.js";

// ── Mock helpers ────────────────────────────────────────────

function createMockDeleteDb(batchResults: Array<{ id: string }[]>) {
	let callCount = 0;

	const returning = vi.fn(() => {
		const result = batchResults[callCount] ?? [];
		callCount++;
		return Promise.resolve(result);
	});

	const where = vi.fn().mockReturnValue({ returning });

	return {
		delete: vi.fn().mockReturnValue({ where }),
	} as never;
}

function createMockUpdateDb(updatedRows: { id: string }[]) {
	const returning = vi.fn().mockResolvedValue(updatedRows);
	const where = vi.fn().mockReturnValue({ returning });
	const set = vi.fn().mockReturnValue({ where });

	return {
		update: vi.fn().mockReturnValue({ set }),
	} as never;
}

function createMockBatchUpdateDb(batchResults: Array<{ id: string }[]>) {
	let callCount = 0;

	const returning = vi.fn(() => {
		const result = batchResults[callCount] ?? [];
		callCount++;
		return Promise.resolve(result);
	});

	const where = vi.fn().mockReturnValue({ returning });
	const set = vi.fn().mockReturnValue({ where });

	return {
		update: vi.fn().mockReturnValue({ set }),
	} as never;
}

function createMockSelectDb(rows: { id: string }[]) {
	const limit = vi.fn().mockResolvedValue(rows);
	const where = vi.fn().mockReturnValue({ limit });
	const from = vi.fn().mockReturnValue({ where });

	return {
		select: vi.fn().mockReturnValue({ from }),
	} as never;
}

// ── deleteExpiredScans ──────────────────────────────────────

describe("deleteExpiredScans", () => {
	it("deletes expired scans in batches", async () => {
		const batch1 = Array.from({ length: 500 }, (_, i) => ({ id: `scan-${i}` }));
		const batch2 = Array.from({ length: 200 }, (_, i) => ({ id: `scan-${500 + i}` }));
		const db = createMockDeleteDb([batch1, batch2]);

		const result = await deleteExpiredScans(db, { batchSize: 500 });

		expect(result.deletedCount).toBe(700);
		expect(result.batchesRun).toBe(2);
	});

	it("returns zero when nothing to delete", async () => {
		const db = createMockDeleteDb([[]]);

		const result = await deleteExpiredScans(db);

		expect(result.deletedCount).toBe(0);
		expect(result.batchesRun).toBe(1);
	});

	it("respects maxBatches limit", async () => {
		const fullBatch = Array.from({ length: 500 }, (_, i) => ({ id: `scan-${i}` }));
		const db = createMockDeleteDb([fullBatch, fullBatch, fullBatch]);

		const result = await deleteExpiredScans(db, { batchSize: 500, maxBatches: 2 });

		expect(result.deletedCount).toBe(1000);
		expect(result.batchesRun).toBe(2);
	});
});

// ── setExpiresAtForScans ────────────────────────────────────

describe("setExpiresAtForScans", () => {
	it("returns count of updated rows", async () => {
		const db = createMockUpdateDb([{ id: "scan-1" }, { id: "scan-2" }]);

		const result = await setExpiresAtForScans(db, "user-1", 90);

		expect(result).toBe(2);
	});

	it("returns 0 when user has no scans", async () => {
		const db = createMockUpdateDb([]);

		const result = await setExpiresAtForScans(db, "user-1", 90);

		expect(result).toBe(0);
	});
});

// ── findExpiredHtmlContent ──────────────────────────────────

describe("findExpiredHtmlContent", () => {
	it("returns expired scan ids", async () => {
		const db = createMockSelectDb([{ id: "scan-1" }, { id: "scan-2" }]);

		const result = await findExpiredHtmlContent(db);

		expect(result).toEqual([{ id: "scan-1" }, { id: "scan-2" }]);
	});

	it("returns empty array when nothing expired", async () => {
		const db = createMockSelectDb([]);

		const result = await findExpiredHtmlContent(db);

		expect(result).toEqual([]);
	});

	it("respects custom limit", async () => {
		const db = createMockSelectDb([{ id: "scan-1" }]);

		const result = await findExpiredHtmlContent(db, { limit: 10 });

		expect(result).toHaveLength(1);
	});
});

// ── purgeExpiredHtmlContent ─────────────────────────────────

describe("purgeExpiredHtmlContent", () => {
	it("purges expired html content in batches", async () => {
		const batch1 = Array.from({ length: 500 }, (_, i) => ({ id: `scan-${i}` }));
		const batch2 = Array.from({ length: 200 }, (_, i) => ({ id: `scan-${500 + i}` }));
		const db = createMockBatchUpdateDb([batch1, batch2]);

		const result = await purgeExpiredHtmlContent(db, { batchSize: 500 });

		expect(result.purgedCount).toBe(700);
		expect(result.batchesRun).toBe(2);
	});

	it("returns zero when nothing to purge", async () => {
		const db = createMockBatchUpdateDb([[]]);

		const result = await purgeExpiredHtmlContent(db);

		expect(result.purgedCount).toBe(0);
		expect(result.batchesRun).toBe(1);
	});

	it("respects maxBatches limit", async () => {
		const fullBatch = Array.from({ length: 500 }, (_, i) => ({ id: `scan-${i}` }));
		const db = createMockBatchUpdateDb([fullBatch, fullBatch, fullBatch]);

		const result = await purgeExpiredHtmlContent(db, { batchSize: 500, maxBatches: 2 });

		expect(result.purgedCount).toBe(1000);
		expect(result.batchesRun).toBe(2);
	});
});
