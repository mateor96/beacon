import { formatRelativeTime, getScoreColor } from "@/lib/format";
import { describe, expect, it } from "vitest";

describe("getScoreColor", () => {
	it("returns red for scores 0-20", () => {
		expect(getScoreColor(0)).toContain("red");
		expect(getScoreColor(20)).toContain("red");
	});

	it("returns orange for scores 21-50", () => {
		expect(getScoreColor(21)).toContain("orange");
		expect(getScoreColor(50)).toContain("orange");
	});

	it("returns yellow for scores 51-75", () => {
		expect(getScoreColor(51)).toContain("yellow");
		expect(getScoreColor(75)).toContain("yellow");
	});

	it("returns green for scores 76-100", () => {
		expect(getScoreColor(76)).toContain("green");
		expect(getScoreColor(100)).toContain("green");
	});
});

describe("formatRelativeTime", () => {
	it("formats recent dates", () => {
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
		const result = formatRelativeTime(fiveMinutesAgo);
		expect(result).toContain("5");
		expect(result).toContain("Minute");
	});
});
