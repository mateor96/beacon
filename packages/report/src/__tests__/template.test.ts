import { describe, expect, it } from "vitest";
import { renderHtml } from "../template.js";
import { makeReportInput } from "./fixtures.js";

describe("renderHtml", () => {
	it("renders a valid HTML document", () => {
		const html = renderHtml(makeReportInput());
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("</html>");
	});

	it("contains the scanned URL", () => {
		const html = renderHtml(makeReportInput());
		expect(html).toContain("https://example.com");
	});

	it("contains the overall score", () => {
		const html = renderHtml(makeReportInput());
		expect(html).toContain("72/100");
	});

	it("contains the readiness level name", () => {
		const html = renderHtml(makeReportInput());
		expect(html).toContain("Strukturiert");
	});

	it("contains the executive summary text", () => {
		const input = makeReportInput();
		const html = renderHtml(input);
		expect(html).toContain("Die Website example.com erreicht einen Beacon-Score von 72/100");
	});

	it("contains check names", () => {
		const html = renderHtml(makeReportInput());
		expect(html).toContain("llms.txt");
		expect(html).toContain("robots.txt KI-Crawler");
		expect(html).toContain("Schema.org / JSON-LD");
	});

	it("contains recommendations", () => {
		const html = renderHtml(makeReportInput());
		expect(html).toContain("Schema.org JSON-LD Markup");
		expect(html).toContain("GPTBot in robots.txt freigeben");
		expect(html).toContain("AGENTS.md Datei erstellen");
	});

	it("applies custom branding colors when provided", () => {
		const html = renderHtml(
			makeReportInput({
				branding: {
					agencyName: "Testfirma GmbH",
					primaryColor: "#ff0000",
					accentColor: "#00ff00",
				},
			}),
		);
		expect(html).toContain("Testfirma GmbH");
		expect(html).toContain("#ff0000");
		expect(html).toContain("#00ff00");
	});
});
