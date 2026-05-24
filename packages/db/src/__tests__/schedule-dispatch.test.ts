import { describe, expect, it, vi } from "vitest";
import * as monitoring from "../queries/monitoring.js";

describe("listProjectIdsWithEnabledSchedule", () => {
	it("selects distinct enabled-schedule project ids", async () => {
		const where = vi.fn().mockResolvedValue([{ projectId: "p1" }, { projectId: "p2" }]);
		const from = vi.fn().mockReturnValue({ where });
		const selectDistinct = vi.fn().mockReturnValue({ from });
		const db = { selectDistinct };

		// biome-ignore lint/suspicious/noExplicitAny: minimal db mock
		const out = await monitoring.listProjectIdsWithEnabledSchedule(db as any);

		expect(selectDistinct).toHaveBeenCalledTimes(1);
		expect(out).toEqual(["p1", "p2"]);
	});
});
