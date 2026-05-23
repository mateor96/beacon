import { describe, expect, it } from "vitest";
import { orderByPrimary } from "../locale-fanout.js";

describe("orderByPrimary", () => {
	it("places primary entries first, preserving relative order", () => {
		const out = orderByPrimary([
			{ id: "a", isPrimary: false },
			{ id: "b", isPrimary: true },
			{ id: "c", isPrimary: false },
			{ id: "d", isPrimary: true },
		]);
		expect(out.map((x) => x.id)).toEqual(["b", "d", "a", "c"]);
	});

	it("returns a new array (does not mutate input)", () => {
		const input = [
			{ id: "x", isPrimary: false },
			{ id: "y", isPrimary: true },
		];
		const out = orderByPrimary(input);
		expect(out).not.toBe(input);
		expect(input.map((x) => x.id)).toEqual(["x", "y"]);
	});

	it("handles empty input", () => {
		expect(orderByPrimary([])).toEqual([]);
	});
});
