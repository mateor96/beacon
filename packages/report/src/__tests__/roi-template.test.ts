import { describe, expect, it } from "vitest";
import { renderDeltaArrowSvg, renderTimelineSvg } from "../roi-charts.js";
import { renderRoiHtml } from "../roi-template.js";
import type { RoiReportInput } from "../types.js";

function makeRoiInput(overrides: Partial<RoiReportInput> = {}): RoiReportInput {
	return {
		projectName: "Test Projekt",
		websiteUrl: "https://example.com",
		periodStart: "2026-01-01T00:00:00Z",
		periodEnd: "2026-04-01T00:00:00Z",
		baselineScore: 35,
		currentScore: 72,
		scoreDelta: 37,
		baselineLevel: 1,
		currentLevel: 2,
		subScoresBefore: { readability: 40, interactivity: 30, transactional: null },
		subScoresAfter: { readability: 75, interactivity: 65, transactional: null },
		snapshots: [
			{ date: "2026-01-01T00:00:00Z", overallScore: 35 },
			{ date: "2026-02-01T00:00:00Z", overallScore: 50 },
			{ date: "2026-03-01T00:00:00Z", overallScore: 65 },
			{ date: "2026-04-01T00:00:00Z", overallScore: 72 },
		],
		citationChanges: [
			{ platform: "chatgpt", before: 0, after: 3 },
			{ platform: "perplexity", before: 0, after: 1 },
		],
		milestones: [
			{
				milestoneType: "score_threshold",
				description: "Score hat 50 Punkte erreicht",
				triggeredAt: "2026-02-15T00:00:00Z",
			},
			{
				milestoneType: "first_mention",
				description: "Erste Erwähnung auf chatgpt",
				triggeredAt: "2026-03-10T00:00:00Z",
			},
		],
		aiTexts: {
			executiveSummary: "Die Website hat sich deutlich verbessert.",
			recommendations: [
				{
					priority: 1,
					title: "Schema.org hinzufügen",
					description: "Strukturierte Daten verbessern die KI-Lesbarkeit.",
					impact: "high",
				},
				{
					priority: 2,
					title: "llms.txt erstellen",
					description: "Erleichtert KI-Systemen den Zugang.",
					impact: "medium",
				},
			],
			outlook: "Die nächsten Schritte sind klar definiert.",
		},
		...overrides,
	};
}

describe("renderRoiHtml", () => {
	it("renders a valid HTML document", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain('lang="de"');
		expect(html).toContain("</html>");
	});

	it("contains project name and URL", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("Test Projekt");
		expect(html).toContain("example.com");
	});

	it("displays score delta", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("+37");
	});

	it("contains sub-score breakdown table", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("Lesbarkeit");
		expect(html).toContain("Interaktivität");
	});

	it("embeds timeline SVG", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("<svg");
		expect(html).toContain("polyline");
	});

	it("renders citation changes table", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("chatgpt");
		expect(html).toContain("perplexity");
	});

	it("renders milestones chronologically", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("Score hat 50 Punkte erreicht");
		expect(html).toContain("Erste Erwähnung auf chatgpt");
	});

	it("renders AI recommendations", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("Schema.org hinzufügen");
		expect(html).toContain("llms.txt erstellen");
	});

	it("renders outlook section", () => {
		const html = renderRoiHtml(makeRoiInput());
		expect(html).toContain("nächsten Schritte sind klar definiert");
	});

	it("applies custom branding", () => {
		const html = renderRoiHtml(
			makeRoiInput({
				branding: { agencyName: "MeineAgentur", primaryColor: "#ff0000", accentColor: "#00ff00" },
			}),
		);
		expect(html).toContain("MeineAgentur");
	});

	it("handles empty milestones", () => {
		const html = renderRoiHtml(makeRoiInput({ milestones: [] }));
		expect(html).not.toContain("Meilensteine");
	});

	it("handles empty citations", () => {
		const html = renderRoiHtml(makeRoiInput({ citationChanges: [] }));
		expect(html).not.toContain("Plattform");
	});

	it("handles missing AI texts", () => {
		const html = renderRoiHtml(makeRoiInput({ aiTexts: undefined }));
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).not.toContain("Empfehlungen");
	});
});

describe("renderTimelineSvg", () => {
	it("renders SVG with data points", () => {
		const svg = renderTimelineSvg([
			{ date: "2026-01-01", overallScore: 30 },
			{ date: "2026-02-01", overallScore: 60 },
		]);
		expect(svg).toContain("<svg");
		expect(svg).toContain("polyline");
		expect(svg).toContain("circle");
	});

	it("handles empty data", () => {
		const svg = renderTimelineSvg([]);
		expect(svg).toContain("Keine Daten");
	});

	it("handles single data point", () => {
		const svg = renderTimelineSvg([{ date: "2026-01-01", overallScore: 50 }]);
		expect(svg).toContain("circle");
	});
});

describe("renderDeltaArrowSvg", () => {
	it("shows green up arrow for positive delta", () => {
		const html = renderDeltaArrowSvg(15);
		expect(html).toContain("#16a34a");
		expect(html).toContain("+15");
	});

	it("shows red down arrow for negative delta", () => {
		const html = renderDeltaArrowSvg(-10);
		expect(html).toContain("#dc2626");
	});

	it("shows neutral for zero delta", () => {
		const html = renderDeltaArrowSvg(0);
		expect(html).toContain("±0");
	});
});
