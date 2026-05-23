import { describe, expect, it } from "vitest";
import {
	DEFAULT_MILESTONE_CONFIG,
	type MilestoneDetectionContext,
	detectMilestones,
} from "../services/milestone-detector.js";

function makeContext(
	overrides: Partial<MilestoneDetectionContext> = {},
): MilestoneDetectionContext {
	return {
		projectId: "proj-1",
		snapshotId: "snap-1",
		currentScore: 0,
		previousScore: null,
		baselineScore: null,
		currentCitationCount: 0,
		baselineCitationCount: null,
		currentPlatforms: [],
		daysSinceBaseline: null,
		existingMilestones: [],
		...overrides,
	};
}

describe("detectMilestones", () => {
	// ── Score Threshold ───────────────────────────────────

	describe("score_threshold", () => {
		it("detects threshold 25 when score crosses from 20 to 30", () => {
			const result = detectMilestones(makeContext({ currentScore: 30, previousScore: 20 }));
			const threshold25 = result.find(
				(m) => m.milestoneType === "score_threshold" && m.milestoneData.threshold === 25,
			);
			expect(threshold25).toBeDefined();
			expect(threshold25?.milestoneData.description).toContain("25");
		});

		it("detects threshold 50 when score crosses from 45 to 55", () => {
			const result = detectMilestones(makeContext({ currentScore: 55, previousScore: 45 }));
			expect(result.some((m) => m.milestoneData.threshold === 50)).toBe(true);
		});

		it("does NOT detect threshold already recorded", () => {
			const result = detectMilestones(
				makeContext({
					currentScore: 30,
					previousScore: 20,
					existingMilestones: [
						{ milestoneType: "score_threshold", milestoneData: { threshold: 25 } },
					],
				}),
			);
			expect(result.filter((m) => m.milestoneType === "score_threshold")).toHaveLength(0);
		});

		it("does NOT detect when score stays same", () => {
			const result = detectMilestones(makeContext({ currentScore: 30, previousScore: 30 }));
			expect(result.filter((m) => m.milestoneType === "score_threshold")).toHaveLength(0);
		});

		it("does NOT detect when score decreases", () => {
			const result = detectMilestones(makeContext({ currentScore: 20, previousScore: 55 }));
			expect(result.filter((m) => m.milestoneType === "score_threshold")).toHaveLength(0);
		});

		it("detects multiple thresholds at once (0 → 60)", () => {
			const result = detectMilestones(makeContext({ currentScore: 60, previousScore: 0 }));
			const thresholds = result
				.filter((m) => m.milestoneType === "score_threshold")
				.map((m) => m.milestoneData.threshold);
			expect(thresholds).toContain(25);
			expect(thresholds).toContain(50);
			expect(thresholds).not.toContain(75);
		});

		it("treats null previousScore as 0 (first scan)", () => {
			const result = detectMilestones(makeContext({ currentScore: 30, previousScore: null }));
			expect(result.some((m) => m.milestoneData.threshold === 25)).toBe(true);
		});

		it("detects all 4 thresholds when score jumps from 0 to 100", () => {
			const result = detectMilestones(makeContext({ currentScore: 100, previousScore: 0 }));
			const thresholds = result
				.filter((m) => m.milestoneType === "score_threshold")
				.map((m) => m.milestoneData.threshold);
			expect(thresholds).toEqual([25, 50, 75, 90]);
		});
	});

	// ── Citation Milestone ────────────────────────────────

	describe("citation_milestone", () => {
		it("detects first citation (0 → 1)", () => {
			const result = detectMilestones(
				makeContext({ currentCitationCount: 1, baselineCitationCount: 0 }),
			);
			expect(result.some((m) => m.milestoneData.description === "Erste KI-Zitierung")).toBe(true);
		});

		it("detects doubled (baseline 5 → current 10)", () => {
			const result = detectMilestones(
				makeContext({ currentCitationCount: 10, baselineCitationCount: 5 }),
			);
			expect(result.some((m) => m.milestoneData.description === "Zitierungen verdoppelt")).toBe(
				true,
			);
		});

		it("detects 10x (baseline 2 → current 20)", () => {
			const result = detectMilestones(
				makeContext({ currentCitationCount: 20, baselineCitationCount: 2 }),
			);
			expect(result.some((m) => m.milestoneData.description === "Zitierungen verzehnfacht")).toBe(
				true,
			);
		});

		it("does NOT detect when no citations", () => {
			const result = detectMilestones(
				makeContext({ currentCitationCount: 0, baselineCitationCount: 0 }),
			);
			expect(result.filter((m) => m.milestoneType === "citation_milestone")).toHaveLength(0);
		});

		it("does NOT detect first citation if already recorded", () => {
			const result = detectMilestones(
				makeContext({
					currentCitationCount: 5,
					baselineCitationCount: 0,
					existingMilestones: [
						{
							milestoneType: "citation_milestone",
							milestoneData: { description: "Erste KI-Zitierung" },
						},
					],
				}),
			);
			expect(
				result.filter(
					(m) =>
						m.milestoneType === "citation_milestone" &&
						m.milestoneData.description === "Erste KI-Zitierung",
				),
			).toHaveLength(0);
		});
	});

	// ── First Mention ─────────────────────────────────────

	describe("first_mention", () => {
		it("detects first mention on a platform", () => {
			const result = detectMilestones(makeContext({ currentPlatforms: ["chatgpt"] }));
			expect(
				result.some(
					(m) => m.milestoneType === "first_mention" && m.milestoneData.platform === "chatgpt",
				),
			).toBe(true);
		});

		it("detects mentions on multiple new platforms", () => {
			const result = detectMilestones(
				makeContext({ currentPlatforms: ["chatgpt", "perplexity", "gemini"] }),
			);
			const mentions = result.filter((m) => m.milestoneType === "first_mention");
			expect(mentions).toHaveLength(3);
		});

		it("does NOT detect if platform milestone already exists", () => {
			const result = detectMilestones(
				makeContext({
					currentPlatforms: ["chatgpt"],
					existingMilestones: [
						{ milestoneType: "first_mention", milestoneData: { platform: "chatgpt" } },
					],
				}),
			);
			expect(result.filter((m) => m.milestoneType === "first_mention")).toHaveLength(0);
		});

		it("deduplicates same platform in input", () => {
			const result = detectMilestones(
				makeContext({ currentPlatforms: ["chatgpt", "chatgpt", "chatgpt"] }),
			);
			expect(result.filter((m) => m.milestoneType === "first_mention")).toHaveLength(1);
		});

		it("returns empty when no platforms", () => {
			const result = detectMilestones(makeContext({ currentPlatforms: [] }));
			expect(result.filter((m) => m.milestoneType === "first_mention")).toHaveLength(0);
		});
	});

	// ── Improvement Rate ──────────────────────────────────

	describe("improvement_rate", () => {
		it("detects >20% improvement in 30 days", () => {
			const result = detectMilestones(
				makeContext({
					currentScore: 75,
					baselineScore: 60,
					daysSinceBaseline: 25,
				}),
			);
			expect(result.some((m) => m.milestoneType === "improvement_rate")).toBe(true);
		});

		it("does NOT detect <20% improvement", () => {
			const result = detectMilestones(
				makeContext({
					currentScore: 66,
					baselineScore: 60,
					daysSinceBaseline: 25,
				}),
			);
			expect(result.filter((m) => m.milestoneType === "improvement_rate")).toHaveLength(0);
		});

		it("does NOT detect when no baseline", () => {
			const result = detectMilestones(
				makeContext({ currentScore: 80, baselineScore: null, daysSinceBaseline: null }),
			);
			expect(result.filter((m) => m.milestoneType === "improvement_rate")).toHaveLength(0);
		});

		it("does NOT detect when baseline score is 0", () => {
			const result = detectMilestones(
				makeContext({ currentScore: 50, baselineScore: 0, daysSinceBaseline: 20 }),
			);
			expect(result.filter((m) => m.milestoneType === "improvement_rate")).toHaveLength(0);
		});

		it("does NOT detect when already recorded", () => {
			const result = detectMilestones(
				makeContext({
					currentScore: 75,
					baselineScore: 60,
					daysSinceBaseline: 25,
					existingMilestones: [
						{ milestoneType: "improvement_rate", milestoneData: { threshold: 25 } },
					],
				}),
			);
			expect(result.filter((m) => m.milestoneType === "improvement_rate")).toHaveLength(0);
		});

		it("does NOT detect score regression", () => {
			const result = detectMilestones(
				makeContext({ currentScore: 50, baselineScore: 70, daysSinceBaseline: 25 }),
			);
			expect(result.filter((m) => m.milestoneType === "improvement_rate")).toHaveLength(0);
		});
	});

	// ── Edge Cases ────────────────────────────────────────

	describe("edge cases", () => {
		it("returns empty for zero-score first scan", () => {
			const result = detectMilestones(makeContext({ currentScore: 0 }));
			expect(result).toHaveLength(0);
		});

		it("handles config override", () => {
			const result = detectMilestones(makeContext({ currentScore: 15, previousScore: 0 }), {
				...DEFAULT_MILESTONE_CONFIG,
				scoreThresholds: [10, 20],
			});
			const thresholds = result.map((m) => m.milestoneData.threshold);
			expect(thresholds).toContain(10);
			expect(thresholds).not.toContain(25);
		});

		it("detects milestones across multiple rule types simultaneously", () => {
			const result = detectMilestones(
				makeContext({
					currentScore: 80,
					previousScore: 0,
					currentCitationCount: 1,
					baselineCitationCount: 0,
					currentPlatforms: ["chatgpt"],
				}),
			);
			const types = new Set(result.map((m) => m.milestoneType));
			expect(types.has("score_threshold")).toBe(true);
			expect(types.has("citation_milestone")).toBe(true);
			expect(types.has("first_mention")).toBe(true);
		});
	});
});
