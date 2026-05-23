import { describe, expect, it } from "vitest";
import { calculateCostCents } from "../../providers/pricing.js";

describe("calculateCostCents", () => {
	it("calculates correct cents for gpt-4o-mini", () => {
		// gpt-4o-mini: $0.15/1M input, $0.60/1M output
		// 1000 input tokens = 0.00015 USD, 500 output tokens = 0.0003 USD
		// total = 0.00045 USD = 0.045 cents
		const result = calculateCostCents("gpt-4o-mini", 1000, 500);
		const expectedCents = (1000 / 1_000_000) * 0.15 * 100 + (500 / 1_000_000) * 0.6 * 100;
		expect(result).toBeCloseTo(expectedCents, 4);
	});

	it("calculates correct cents for claude-haiku", () => {
		// claude-haiku-4-5-20251001: $0.80/1M input, $4.00/1M output
		// 10_000 input = 0.008 USD, 2_000 output = 0.008 USD
		// total = 0.016 USD = 1.6 cents
		const result = calculateCostCents("claude-haiku-4-5-20251001", 10_000, 2_000);
		const expectedCents = (10_000 / 1_000_000) * 0.8 * 100 + (2_000 / 1_000_000) * 4.0 * 100;
		expect(result).toBeCloseTo(expectedCents, 4);
	});

	it("returns 0 for unknown model", () => {
		const result = calculateCostCents("unknown-model-xyz", 5000, 1000);
		expect(result).toBe(0);
	});

	it("rounds to 4 decimal places via Math.round", () => {
		// Use a case that would produce many decimal digits
		// gpt-4o-mini: 1 input token = 0.000015 USD = 0.0015 cents
		// 1 output token = 0.00006 USD = 0.006 cents
		// total = 0.0075 cents — already clean, but let's use odd numbers
		const result = calculateCostCents("gpt-4o-mini", 7, 3);
		// input: (7/1M)*0.15*100 = 0.000105 cents
		// output: (3/1M)*0.60*100 = 0.00018 cents
		// total: 0.000285 cents → round(0.000285 * 10000)/10000 = 0.0003
		expect(result).toBe(Math.round(0.000285 * 10_000) / 10_000);
	});
});
