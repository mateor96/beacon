import { describe, expect, it } from "vitest";
import { flattenReportTexts } from "../lib/report-mapper";

const input = {
	executiveSummary: "Executive summary text",
	checkSummaries: {
		"llms-txt": {
			title: "LLMs.txt",
			assessment: "Missing file.",
			recommendation: "Create llms.txt.",
		},
		"robots-txt": {
			title: "Robots.txt",
			assessment: "Well configured.",
			recommendation: "No changes needed.",
		},
	},
	categoryAssessments: {
		readability: { title: "Readability", summary: "Good readability overall", score: 80 },
		interactivity: { title: "Interactivity", summary: "Needs improvement", score: 50 },
		transactional: { title: "Transactional", summary: "Not yet ready", score: 30 },
	},
	recommendations: [
		{
			priority: 3,
			title: "Add schema",
			description: "Add structured data",
			impact: "medium" as const,
		},
		{ priority: 1, title: "Add llms.txt", description: "Create the file", impact: "high" as const },
		{ priority: 2, title: "Fix meta", description: "Update meta tags", impact: "high" as const },
	],
	conclusion: "Overall conclusion text",
};

describe("flattenReportTexts", () => {
	it("maps executiveSummary and conclusion directly", () => {
		const result = flattenReportTexts(input);
		expect(result.executiveSummary).toBe("Executive summary text");
		expect(result.conclusion).toBe("Overall conclusion text");
	});

	it("flattens checkSummaries to assessment + recommendation strings", () => {
		const result = flattenReportTexts(input);
		expect(result.checkSummaries["llms-txt"]).toBe("Missing file. Create llms.txt.");
		expect(result.checkSummaries["robots-txt"]).toBe("Well configured. No changes needed.");
	});

	it("flattens categoryAssessments to summary strings", () => {
		const result = flattenReportTexts(input);
		expect(result.categoryAssessments.readability).toBe("Good readability overall");
		expect(result.categoryAssessments.interactivity).toBe("Needs improvement");
		expect(result.categoryAssessments.transactional).toBe("Not yet ready");
	});

	it("sorts recommendations by priority and formats as title: description", () => {
		const result = flattenReportTexts(input);
		expect(result.recommendations).toEqual([
			"Add llms.txt: Create the file",
			"Fix meta: Update meta tags",
			"Add schema: Add structured data",
		]);
	});
});
