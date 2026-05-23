import { describe, expect, it } from "vitest";
import { computePreviousWindow } from "../queries/ai-visibility";

describe("computePreviousWindow", () => {
	it("prevTo is 1 ms before from, prevFrom mirrors the window length", () => {
		const from = new Date("2024-02-01T00:00:00.000Z");
		const to = new Date("2024-02-10T23:59:59.999Z");
		const prev = computePreviousWindow(from, to);
		expect(prev.to.getTime()).toBe(from.getTime() - 1);
		const length = to.getTime() - from.getTime();
		expect(prev.to.getTime() - prev.from.getTime()).toBe(length);
	});

	it("handles single-day windows", () => {
		const from = new Date("2024-03-15T00:00:00.000Z");
		const to = new Date("2024-03-15T23:59:59.999Z");
		const prev = computePreviousWindow(from, to);
		expect(prev.to.getTime()).toBe(from.getTime() - 1);
		expect(prev.from.getTime()).toBeLessThan(prev.to.getTime());
	});
});
