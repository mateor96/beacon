import { describe, expect, it } from "vitest";
import { renderGaugeSvg, renderLevelBadge, renderScoreBar, scoreToColor } from "../scores.js";

describe("scoreToColor", () => {
	it("returns green for high scores (>=80)", () => {
		expect(scoreToColor(80)).toBe("#16a34a");
		expect(scoreToColor(100)).toBe("#16a34a");
	});

	it("returns amber for medium scores (40-79)", () => {
		expect(scoreToColor(40)).toBe("#d97706");
		expect(scoreToColor(79)).toBe("#d97706");
	});

	it("returns red for low scores (<40)", () => {
		expect(scoreToColor(0)).toBe("#dc2626");
		expect(scoreToColor(39)).toBe("#dc2626");
	});
});

describe("renderGaugeSvg", () => {
	it("contains the score number", () => {
		const svg = renderGaugeSvg(72);
		expect(svg).toContain("72");
	});

	it("contains SVG elements (circle, text)", () => {
		const svg = renderGaugeSvg(50);
		expect(svg).toContain("<svg");
		expect(svg).toContain("<circle");
		expect(svg).toContain("<text");
		expect(svg).toContain("/100");
	});
});

describe("renderLevelBadge", () => {
	it("contains the level name", () => {
		expect(renderLevelBadge(0)).toContain("Unsichtbar");
		expect(renderLevelBadge(1)).toContain("Lesbar");
		expect(renderLevelBadge(2)).toContain("Strukturiert");
		expect(renderLevelBadge(3)).toContain("Optimiert");
	});
});

describe("renderScoreBar", () => {
	it("contains the label and score", () => {
		const bar = renderScoreBar("Lesbarkeit", 85, "pass");
		expect(bar).toContain("Lesbarkeit");
		expect(bar).toContain("85");
	});
});
