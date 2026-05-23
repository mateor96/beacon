import { describe, expect, it, vi } from "vitest";
import * as dlq from "../queries/dead-letter-jobs.js";

// ── Mock helpers ────────────────────────────────────────────

function createMockDb() {
	const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
	const values = vi.fn().mockReturnValue({ onConflictDoNothing });
	const insertFn = vi.fn().mockReturnValue({ values });

	const offset = vi.fn().mockResolvedValue([]);
	const limit = vi.fn().mockReturnValue({ offset });
	const orderBy = vi.fn().mockReturnValue({ limit });
	const where = vi.fn().mockReturnValue({ orderBy });
	const from = vi.fn().mockReturnValue({ where, orderBy });
	const selectFn = vi.fn().mockReturnValue({ from });

	const groupBy = vi.fn().mockResolvedValue([]);
	const selectGroupFn = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ groupBy }) });

	const returning = vi.fn().mockResolvedValue([]);
	const deleteWhere = vi.fn().mockReturnValue({ returning });
	const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });

	return {
		insert: insertFn,
		select: selectFn,
		selectGroup: selectGroupFn,
		delete: deleteFn,
		_mocks: {
			onConflictDoNothing,
			values,
			insertFn,
			offset,
			limit,
			orderBy,
			where,
			from,
			selectFn,
			returning,
			deleteWhere,
			deleteFn,
			groupBy,
		},
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("dead-letter-jobs queries", () => {
	it("insert calls db.insert with correct values and onConflictDoNothing", async () => {
		const db = createMockDb();
		const data = {
			queue: "scan",
			jobId: "job-1",
			jobData: { scanId: "s1", url: "https://example.com" },
			errorMessage: "timeout",
			attemptsMade: 3,
			maxAttempts: 3,
		};

		await dlq.insert(db as never, data);

		expect(db.insert).toHaveBeenCalled();
		expect(db._mocks.values).toHaveBeenCalledWith(data);
		expect(db._mocks.onConflictDoNothing).toHaveBeenCalled();
	});

	it("getByQueue filters by queue and orders by failedAt DESC", async () => {
		const db = createMockDb();

		await dlq.getByQueue(db as never, "scan", { limit: 10, offset: 5 });

		expect(db.select).toHaveBeenCalled();
		expect(db._mocks.from).toHaveBeenCalled();
		expect(db._mocks.where).toHaveBeenCalled();
		expect(db._mocks.orderBy).toHaveBeenCalled();
		expect(db._mocks.limit).toHaveBeenCalledWith(10);
		expect(db._mocks.offset).toHaveBeenCalledWith(5);
	});

	it("getAll returns entries ordered by failedAt DESC with default limit", async () => {
		const db = createMockDb();

		await dlq.getAll(db as never);

		expect(db.select).toHaveBeenCalled();
		expect(db._mocks.from).toHaveBeenCalled();
		expect(db._mocks.limit).toHaveBeenCalledWith(50);
		expect(db._mocks.offset).toHaveBeenCalledWith(0);
	});

	it("deleteOlderThan deletes rows older than cutoff and returns count", async () => {
		const db = createMockDb();
		db._mocks.returning.mockResolvedValue([{ id: "a" }, { id: "b" }]);

		const cutoff = new Date("2025-01-01");
		const count = await dlq.deleteOlderThan(db as never, cutoff);

		expect(db.delete).toHaveBeenCalled();
		expect(db._mocks.deleteWhere).toHaveBeenCalled();
		expect(db._mocks.returning).toHaveBeenCalled();
		expect(count).toBe(2);
	});
});
