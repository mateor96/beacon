import { describe, expect, it, vi } from "vitest";
import * as email from "../queries/email.js";

function createMockSelectDb(rows: unknown[]) {
	const offset = vi.fn().mockResolvedValue(rows);
	const limit = vi.fn().mockReturnValue({ offset });
	const orderBy = vi.fn().mockReturnValue({ limit });
	const from = vi.fn().mockReturnValue({ orderBy });
	const select = vi.fn().mockReturnValue({ from });
	return { db: { select }, mocks: { select, from, orderBy, limit, offset } };
}

describe("listRecentEmailLogs", () => {
	it("selects email logs ordered newest-first with default limit/offset", async () => {
		const rows = [{ id: "e1" }, { id: "e2" }];
		const { db, mocks } = createMockSelectDb(rows);

		// biome-ignore lint/suspicious/noExplicitAny: minimal db mock for unit test
		const result = await email.listRecentEmailLogs(db as any);

		expect(mocks.select).toHaveBeenCalledTimes(1);
		expect(mocks.orderBy).toHaveBeenCalledTimes(1);
		expect(mocks.limit).toHaveBeenCalledWith(50);
		expect(mocks.offset).toHaveBeenCalledWith(0);
		expect(result).toBe(rows);
	});

	it("honours explicit limit and offset", async () => {
		const { db, mocks } = createMockSelectDb([]);

		// biome-ignore lint/suspicious/noExplicitAny: minimal db mock for unit test
		await email.listRecentEmailLogs(db as any, { limit: 10, offset: 20 });

		expect(mocks.limit).toHaveBeenCalledWith(10);
		expect(mocks.offset).toHaveBeenCalledWith(20);
	});
});
