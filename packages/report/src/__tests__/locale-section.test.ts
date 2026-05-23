import { describe, expect, it } from "vitest";
import { type LocaleSectionRow, renderLocaleSection } from "../locale-section.js";

const baseRow = (overrides: Partial<LocaleSectionRow> = {}): LocaleSectionRow => ({
	displayName: "Deutsch (Deutschland)",
	countryCode: "DE",
	languageCode: "de",
	score: 80,
	previousScore: 70,
	scannedAt: "2026-04-15T12:00:00Z",
	topRecommendations: ["llms.txt hinzufügen", "Schema.org ergänzen"],
	isPrimary: true,
	...overrides,
});

describe("renderLocaleSection", () => {
	it("returns empty string when no rows", () => {
		expect(renderLocaleSection({ clientDomain: "x.com", rows: [] })).toBe("");
	});

	it("renders title, bar chart and detail table for 1 locale", () => {
		const html = renderLocaleSection({
			clientDomain: "my.co",
			rows: [baseRow()],
		});
		expect(html).toContain("AI-Readiness nach Markt/Sprache");
		expect(html).toContain("Deutsch (Deutschland)");
		expect(html).toContain("80"); // score in bar
		expect(html).toContain("+10"); // delta from prev=70
		expect(html).toContain("Primaer");
		expect(html).toContain("llms.txt hinzufügen");
	});

	it("paginates detail rows: 5 per page", () => {
		const rows = Array.from({ length: 12 }, (_, i) =>
			baseRow({
				displayName: `Locale ${i}`,
				countryCode: "DE",
				languageCode: "de",
				isPrimary: i === 0,
			}),
		);
		const html = renderLocaleSection({ clientDomain: "x.com", rows });
		const pageBreaks = (html.match(/page-break-before: always/g) ?? []).length;
		// 1 for the chart section + ceil(12/5) = 3 detail pages → 4 page breaks
		expect(pageBreaks).toBe(4);
		expect(html).toContain("Detail 1–5 von 12");
		expect(html).toContain("Detail 6–10 von 12");
		expect(html).toContain("Detail 11–12 von 12");
	});

	it("shows '—' when previousScore is null", () => {
		const html = renderLocaleSection({
			clientDomain: "x.com",
			rows: [baseRow({ previousScore: null })],
		});
		expect(html).toContain("—");
	});

	it("shows 'noch nicht gescannt' when scannedAt is null", () => {
		const html = renderLocaleSection({
			clientDomain: "x.com",
			rows: [baseRow({ scannedAt: null })],
		});
		expect(html).toContain("noch nicht gescannt");
	});

	it("applies primary color from branding", () => {
		const html = renderLocaleSection({
			clientDomain: "x.com",
			rows: [baseRow()],
			primaryColor: "#ff00aa",
		});
		expect(html).toContain("#ff00aa");
	});

	it("limits top recommendations to 3 per row", () => {
		const html = renderLocaleSection({
			clientDomain: "x.com",
			rows: [
				baseRow({
					topRecommendations: ["one", "two", "three", "four", "five"],
				}),
			],
		});
		expect(html).toContain("one; two; three");
		expect(html).not.toContain("four");
	});
});
