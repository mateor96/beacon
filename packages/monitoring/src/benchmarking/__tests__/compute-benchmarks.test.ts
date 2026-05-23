import { describe, expect, it } from "vitest";
import { computeBenchmarks } from "../compute-benchmarks.js";
import type { BenchmarkInput } from "../types.js";

type BenchmarkReport = ReturnType<typeof computeBenchmarks>;
function findCompetitor(
	report: BenchmarkReport,
	name: string,
): BenchmarkReport["competitors"][number] {
	const c = report.competitors.find((c) => c.name === name);
	if (!c) throw new Error(`competitor "${name}" not found in report`);
	return c;
}

const BASE_INPUT: BenchmarkInput = {
	snapshotId: "snap-1",
	projectId: "proj-1",
	aiEngine: "chatgpt",
	brandName: "Acme Corp",
	responseText:
		"Acme Corp is great. Salesforce leads the market. HubSpot is good for SMBs. Salesforce has strong features.",
	brandMentionCount: 1,
	brandRankPosition: 2,
	competitorKeywords: ["Salesforce", "HubSpot"],
};

describe("computeBenchmarks", () => {
	it("computes Share of Voice for all competitors", () => {
		const compRanks = new Map([
			["Salesforce", 1],
			["HubSpot", 3],
		]);
		const report = computeBenchmarks(BASE_INPUT, compRanks);

		expect(report.competitors.length).toBe(2);
		// Brand=1, Salesforce=2, HubSpot=1 → total=4
		const sf = findCompetitor(report, "Salesforce");
		expect(sf.shareOfVoice).toBeCloseTo(0.5, 1); // 2/4
		const hs = findCompetitor(report, "HubSpot");
		expect(hs.shareOfVoice).toBeCloseTo(0.25, 1); // 1/4
	});

	it("includes competitor rank from ranking data", () => {
		const compRanks = new Map([
			["Salesforce", 1],
			["HubSpot", 3],
		]);
		const report = computeBenchmarks(BASE_INPUT, compRanks);

		const sf = findCompetitor(report, "Salesforce");
		expect(sf.avgRank).toBe(1);
		const hs = findCompetitor(report, "HubSpot");
		expect(hs.avgRank).toBe(3);
	});

	it("sets avgRank to 0 when competitor not in rankings", () => {
		const compRanks = new Map<string, number>();
		const report = computeBenchmarks(BASE_INPUT, compRanks);

		expect(report.competitors[0].avgRank).toBe(0);
	});

	it("computes positive sentiment from context", () => {
		const input: BenchmarkInput = {
			...BASE_INPUT,
			responseText: "Salesforce provides excellent and reliable service with outstanding features.",
			competitorKeywords: ["Salesforce"],
		};
		const report = computeBenchmarks(input, new Map());
		const sf = findCompetitor(report, "Salesforce");
		expect(sf.avgSentiment).toBe(1); // positive context
	});

	it("computes negative sentiment from context", () => {
		const input: BenchmarkInput = {
			...BASE_INPUT,
			responseText:
				"HubSpot has poor and unreliable documentation that disappoints users consistently.",
			competitorKeywords: ["HubSpot"],
		};
		const report = computeBenchmarks(input, new Map());
		const hs = findCompetitor(report, "HubSpot");
		expect(hs.avgSentiment).toBe(-1); // negative context
	});

	it("returns empty competitors for empty keywords", () => {
		const input = { ...BASE_INPUT, competitorKeywords: [] };
		const report = computeBenchmarks(input, new Map());
		expect(report.competitors).toEqual([]);
	});

	it("handles brand with 0 mentions", () => {
		const input = { ...BASE_INPUT, brandMentionCount: 0 };
		const report = computeBenchmarks(input, new Map());
		// Salesforce=2, HubSpot=1 → total=3, brand SoV=0
		expect(report.totalMentions).toBe(3);
		const sf = findCompetitor(report, "Salesforce");
		expect(sf.shareOfVoice).toBeCloseTo(0.667, 1); // 2/3
	});

	it("handles no competitor mentions found", () => {
		const input: BenchmarkInput = {
			...BASE_INPUT,
			responseText: "Acme Corp is the only player in this market.",
			competitorKeywords: ["Salesforce"],
		};
		const report = computeBenchmarks(input, new Map());
		expect(report.competitors[0].mentionCount).toBe(0);
		expect(report.competitors[0].shareOfVoice).toBe(0);
	});

	it("handles total 0 mentions gracefully", () => {
		const input: BenchmarkInput = {
			...BASE_INPUT,
			brandMentionCount: 0,
			responseText: "Nothing relevant here.",
			competitorKeywords: ["Salesforce"],
		};
		const report = computeBenchmarks(input, new Map());
		expect(report.competitors[0].shareOfVoice).toBe(0);
		expect(report.totalMentions).toBe(0);
	});

	it("returns correct totalMentions", () => {
		const report = computeBenchmarks(BASE_INPUT, new Map());
		// brand=1, Salesforce=2, HubSpot=1 → 4
		expect(report.totalMentions).toBe(4);
	});

	it("populates durationMs", () => {
		const report = computeBenchmarks(BASE_INPUT, new Map());
		expect(report.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("sentiment defaults to 0 for unmentioned competitor", () => {
		const input: BenchmarkInput = {
			...BASE_INPUT,
			responseText: "Acme Corp is great.",
			competitorKeywords: ["Salesforce"],
		};
		const report = computeBenchmarks(input, new Map());
		expect(report.competitors[0].avgSentiment).toBe(0);
	});
});
