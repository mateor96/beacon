import { describe, expect, it } from "vitest";
import { getReportStyles } from "../styles.js";

describe("getReportStyles", () => {
	const css = getReportStyles("#0f172a", "#3b82f6");

	it("injects provided colors as CSS custom properties", () => {
		expect(css).toContain("--primary: #0f172a");
		expect(css).toContain("--accent: #3b82f6");
	});

	it("contains expected selectors", () => {
		expect(css).toContain(".report-page");
		expect(css).toContain(".check-card");
		expect(css).toContain(".score-overview");
		expect(css).toContain(".badge");
		expect(css).toContain(".section-title");
	});

	it("contains @page rule for A4 print", () => {
		expect(css).toContain("@page");
		expect(css).toContain("A4");
	});

	it("contains status color classes", () => {
		expect(css).toContain(".text-pass");
		expect(css).toContain(".text-warn");
		expect(css).toContain(".text-fail");
	});
});
