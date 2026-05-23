import type { CheckId, ScanCheck } from "@beacon/shared";
import { CHECK_WEIGHTS } from "@beacon/shared";
import { describe, expect, it } from "vitest";
import {
	calculateComparison,
	calculateCurrentReadiness,
	calculateFutureReadiness,
	calculateLevelScores,
	calculateOverallScore,
	calculateReadinessLevel,
	calculateScoreBreakdown,
} from "../scoring.js";

function getCheck(checks: ScanCheck[], id: CheckId): ScanCheck {
	const c = checks.find((c) => c.id === id);
	if (!c) throw new Error(`check ${id} not found`);
	return c;
}

function makeCheck(overrides: Partial<ScanCheck> = {}): ScanCheck {
	return {
		id: "llms-txt",
		name: "llms.txt",
		status: "pass",
		category: "readability",
		severity: "critical",
		score: 100,
		summary: "OK",
		issues: [],
		...overrides,
	};
}

/** Helper: create a full set of 14 checks all with the same score */
function makeAllChecks(score: number, status: "pass" | "fail" | "warn" = "pass"): ScanCheck[] {
	const ids: CheckId[] = [
		"robots-txt",
		"sitemap-xml",
		"llms-txt",
		"schema-org",
		"content-structure",
		"semantic-quality",
		"citation-readiness",
		"content-freshness",
		"faq-schema",
		"meta-tags",
		"js-rendering",
		"performance",
		"webmcp",
		"agents-md",
	];
	return ids.map((id) => makeCheck({ id, score, status }));
}

// ── calculateOverallScore ───────────────────────────────────

describe("calculateOverallScore (weighted average)", () => {
	it("returns 100 when all checks score 100", () => {
		expect(calculateOverallScore(makeAllChecks(100))).toBe(100);
	});

	it("returns 0 when all checks score 0", () => {
		expect(calculateOverallScore(makeAllChecks(0))).toBe(0);
	});

	it("returns 0 for empty checks", () => {
		expect(calculateOverallScore([])).toBe(0);
	});

	it("returns 50 when all checks score 50", () => {
		expect(calculateOverallScore(makeAllChecks(50))).toBe(50);
	});

	it("weights higher-weight checks more heavily", () => {
		// robots-txt (weight 13) scores 100, performance (weight 3) scores 0
		const checks = [
			makeCheck({ id: "robots-txt", score: 100 }),
			makeCheck({ id: "performance", score: 0 }),
		];
		// (100*13 + 0*3) / 16 = 81.25 → 81
		expect(calculateOverallScore(checks)).toBe(81);
	});

	it("weights lower-weight checks less", () => {
		// performance (weight 3) scores 100, robots-txt (weight 13) scores 0
		const checks = [
			makeCheck({ id: "robots-txt", score: 0 }),
			makeCheck({ id: "performance", score: 100 }),
		];
		// (0*13 + 100*3) / 16 = 18.75 → 19
		expect(calculateOverallScore(checks)).toBe(19);
	});

	it("rounds to nearest integer", () => {
		const checks = [
			makeCheck({ id: "robots-txt", score: 33 }), // 33*13 = 429
			makeCheck({ id: "llms-txt", score: 66 }), // 66*7 = 462
		];
		// (429 + 462) / 20 = 44.55 → 45
		expect(calculateOverallScore(checks)).toBe(45);
	});

	it("uses check.score, not check.status", () => {
		// Status is "fail" but score is 80 — weighted average uses score
		const checks = [makeCheck({ id: "robots-txt", status: "fail", score: 80 })];
		expect(calculateOverallScore(checks)).toBe(80);
	});

	it("clamps scores above 100", () => {
		const checks = [makeCheck({ id: "robots-txt", score: 150 })];
		expect(calculateOverallScore(checks)).toBe(100);
	});

	it("clamps scores below 0", () => {
		const checks = [makeCheck({ id: "robots-txt", score: -10 })];
		expect(calculateOverallScore(checks)).toBe(0);
	});

	it("site blocking AI crawlers loses at most 13 points", () => {
		// robots-txt=0, everything else=100
		const checks = makeAllChecks(100);
		const robotsCheck = getCheck(checks, "robots-txt");
		robotsCheck.score = 0;
		// (0*13 + 100*87) / 100 = 87 (robots-txt weight=13, total=100)
		expect(calculateOverallScore(checks)).toBe(87);
	});
});

// ── calculateLevelScores ────────────────────────────────────

describe("calculateLevelScores (weighted per category)", () => {
	it("returns null for categories with no checks (not evaluated)", () => {
		const checks = [makeCheck({ id: "llms-txt", score: 80 })];
		const scores = calculateLevelScores(checks);

		expect(scores.readability).toBe(80);
		expect(scores.interactivity).toBeNull(); // no interactivity checks → null
		expect(scores.transactional).toBeNull(); // no transactional checks → null
	});

	it("calculates per-category weighted average", () => {
		const checks = [
			makeCheck({ id: "llms-txt", score: 0 }), // readability, weight 7
			makeCheck({ id: "webmcp", score: 100, category: "interactivity" }), // interactivity, weight 0
		];
		const scores = calculateLevelScores(checks);

		expect(scores.readability).toBe(0); // 0*7/7 = 0
		expect(scores.interactivity).toBeNull(); // webmcp weight=0 → no weighted checks → null
		expect(scores.transactional).toBeNull(); // no checks → null
	});

	it("uses registry category, not ScanCheck.category", () => {
		// llms-txt is "readability" in CHECK_METADATA_MAP
		const checks = [
			makeCheck({
				id: "llms-txt",
				category: "transactional", // WRONG — registry says "readability"
				score: 50,
			}),
		];
		const scores = calculateLevelScores(checks);

		expect(scores.readability).toBe(50); // registry wins
		expect(scores.transactional).toBeNull(); // unaffected — still no checks
	});

	it("weights checks within a category", () => {
		// readability: robots-txt (13) + llms-txt (7) = total weight 20
		const checks = [
			makeCheck({ id: "robots-txt", score: 100 }), // 100*13=1300
			makeCheck({ id: "llms-txt", score: 0 }), // 0*7=0
		];
		const scores = calculateLevelScores(checks);
		// 1300/20 = 65
		expect(scores.readability).toBe(65);
	});

	it("failures in one category do not affect other categories", () => {
		const checks = [
			makeCheck({ id: "llms-txt", score: 0 }),
			makeCheck({ id: "webmcp", score: 0, category: "interactivity" }),
		];
		const scores = calculateLevelScores(checks);
		expect(scores.readability).toBe(0);
		expect(scores.interactivity).toBeNull(); // webmcp weight=0 → no weighted checks → null
		expect(scores.transactional).toBeNull(); // unaffected — no checks
	});
});

// ── calculateReadinessLevel (hybrid gating) ─────────────────

describe("calculateReadinessLevel", () => {
	it("returns level 3 when score > 75 and all gates pass", () => {
		const checks = makeAllChecks(100);
		expect(calculateReadinessLevel(90, checks)).toBe(3);
	});

	it("downgrades level when level 3 gates fail", () => {
		// Score qualifies for L3 but llms-txt (L3 gate) scores 0
		const checks = makeAllChecks(100);
		getCheck(checks, "llms-txt").score = 0;
		expect(calculateReadinessLevel(90, checks)).toBe(2);
	});

	it("downgrades to level 0 when robots-txt fails", () => {
		// robots-txt is L1 gate — failing it caps at L0
		const checks = makeAllChecks(100);
		getCheck(checks, "robots-txt").score = 10;
		expect(calculateReadinessLevel(90, checks)).toBe(0);
	});

	it("returns level 0 for score <= 20 regardless of gates", () => {
		expect(calculateReadinessLevel(15, makeAllChecks(100))).toBe(0);
	});

	it("returns level 0 for empty checks and score 0", () => {
		expect(calculateReadinessLevel(0, [])).toBe(0);
	});

	it("gate check at exactly threshold (50) passes", () => {
		const checks = makeAllChecks(100);
		getCheck(checks, "robots-txt").score = 50;
		expect(calculateReadinessLevel(90, checks)).toBe(3);
	});

	it("gate check at 49 (below threshold) fails", () => {
		const checks = makeAllChecks(100);
		getCheck(checks, "robots-txt").score = 49;
		expect(calculateReadinessLevel(90, checks)).toBe(0);
	});

	it("score is the ceiling — gates cannot raise level", () => {
		// Score = 40 → L1, even though all gates pass
		expect(calculateReadinessLevel(40, makeAllChecks(100))).toBe(1);
	});

	it("cumulative gates: L2 requires L1 gates too", () => {
		// meta-tags is L2 gate — failing it caps at L1
		const checks = makeAllChecks(100);
		getCheck(checks, "meta-tags").score = 10;
		expect(calculateReadinessLevel(80, checks)).toBe(1);
	});
});

// ── calculateScoreBreakdown ─────────────────────────────────

describe("calculateScoreBreakdown", () => {
	it("returns complete breakdown structure", () => {
		const checks = makeAllChecks(80);
		const breakdown = calculateScoreBreakdown(checks);

		expect(breakdown.overallScore).toBe(80);
		expect(breakdown.totalWeight).toBe(100);
		expect(breakdown.checks).toHaveLength(14);
		expect(breakdown.readinessLevel).toBeGreaterThanOrEqual(0);
		expect(breakdown.readinessLevel).toBeLessThanOrEqual(3);
		expect(breakdown.levelScores).toHaveProperty("readability");
		expect(breakdown.levelScores).toHaveProperty("interactivity");
		expect(breakdown.levelScores).toHaveProperty("transactional");
	});

	it("check entries have correct weight from CHECK_WEIGHTS", () => {
		const checks = makeAllChecks(100);
		const breakdown = calculateScoreBreakdown(checks);
		for (const entry of breakdown.checks) {
			expect(entry.weight).toBe(CHECK_WEIGHTS[entry.checkId]);
		}
	});

	it("returns 0 for empty checks with null levelScores", () => {
		const breakdown = calculateScoreBreakdown([]);
		expect(breakdown.overallScore).toBe(0);
		expect(breakdown.checks).toHaveLength(0);
		expect(breakdown.totalWeight).toBe(0);
		expect(breakdown.levelScores.readability).toBeNull();
		expect(breakdown.levelScores.interactivity).toBeNull();
		expect(breakdown.levelScores.transactional).toBeNull();
	});
});

// ── Scoring Invariants ──────────────────────────────────────

describe("error status exclusion", () => {
	it("excludes crashed checks from overall score", () => {
		const checks = [
			makeCheck({ id: "robots-txt", score: 100 }),
			makeCheck({ id: "llms-txt", score: 100, status: "error" }),
		];
		// Only robots-txt (weight 13, score 100) should count
		// llms-txt (status "error") excluded → (100*12) / 12 = 100
		expect(calculateOverallScore(checks)).toBe(100);
	});

	it("crashed check with score 0 does not depress average", () => {
		const withCrash = makeAllChecks(100);
		const crashedCheck = getCheck(withCrash, "semantic-quality");
		crashedCheck.status = "error";
		crashedCheck.score = 0;

		// semantic-quality (weight 10) excluded → denominator = 90, all others 100
		// (100*90) / 90 = 100
		expect(calculateOverallScore(withCrash)).toBe(100);
	});

	it("all checks crashed returns 0", () => {
		const checks = makeAllChecks(100);
		for (const check of checks) {
			check.status = "error";
			check.score = 0;
		}
		expect(calculateOverallScore(checks)).toBe(0);
	});

	it("excludes crashed checks from category level scores", () => {
		const checks = [
			makeCheck({ id: "robots-txt", score: 100 }),
			makeCheck({ id: "llms-txt", score: 0, status: "error" }),
		];
		const scores = calculateLevelScores(checks);
		// Only robots-txt counts for readability → 100
		expect(scores.readability).toBe(100);
	});

	it("excludes crashed checks from score breakdown", () => {
		const checks = [
			makeCheck({ id: "robots-txt", score: 80 }),
			makeCheck({ id: "llms-txt", score: 0, status: "error" }),
		];
		const breakdown = calculateScoreBreakdown(checks);
		// Only 1 non-crashed check in breakdown
		expect(breakdown.checks).toHaveLength(1);
		expect(breakdown.checks[0].checkId).toBe("robots-txt");
		expect(breakdown.totalWeight).toBe(13);
	});

	it("crashed gate check does not block level progression", () => {
		const checks = makeAllChecks(100);
		// robots-txt is L1 gate — crash it
		const robotsCheck = getCheck(checks, "robots-txt");
		robotsCheck.status = "error";
		robotsCheck.score = 0;

		// Crashed gate = not evaluated, should not block
		// Overall score recalculated without robots-txt: (100*88) / 88 = 100
		const overallScore = calculateOverallScore(checks);
		expect(overallScore).toBe(100);
		expect(calculateReadinessLevel(overallScore, checks)).toBe(3);
	});
});

describe("split scoring (current vs future readiness)", () => {
	it("returns 100 for both when all checks score 100", () => {
		const checks = makeAllChecks(100);
		expect(calculateCurrentReadiness(checks)).toBe(100);
		expect(calculateFutureReadiness(checks)).toBe(100);
	});

	it("returns 0 for both when all checks score 0", () => {
		const checks = makeAllChecks(0);
		expect(calculateCurrentReadiness(checks)).toBe(0);
		expect(calculateFutureReadiness(checks)).toBe(0);
	});

	it("current ignores future checks entirely", () => {
		const checks = makeAllChecks(0);
		// Set only future checks to 100
		for (const c of checks) {
			if (["llms-txt", "webmcp", "agents-md"].includes(c.id)) c.score = 100;
		}
		expect(calculateCurrentReadiness(checks)).toBe(0);
		expect(calculateFutureReadiness(checks)).toBe(100);
	});

	it("future ignores current checks entirely", () => {
		const checks = makeAllChecks(0);
		// Set only current checks to 100
		for (const c of checks) {
			if (!["llms-txt", "webmcp", "agents-md"].includes(c.id)) c.score = 100;
		}
		expect(calculateCurrentReadiness(checks)).toBe(100);
		expect(calculateFutureReadiness(checks)).toBe(0);
	});

	it("computes correct weighted average for mixed future scores", () => {
		const checks = [
			makeCheck({ id: "llms-txt", score: 70 }), // 70*7=490 (only weighted future check)
			makeCheck({ id: "webmcp", score: 40 }), // weight=0, skipped
			makeCheck({ id: "agents-md", score: 0 }), // weight=0, skipped
		];
		// Only llms-txt counts: (70*7) / 7 = 70
		expect(calculateFutureReadiness(checks)).toBe(70);
	});

	it("excludes error-status checks from both sub-scores", () => {
		const checks = makeAllChecks(100);
		const robotsCheck = getCheck(checks, "robots-txt");
		robotsCheck.status = "error";
		robotsCheck.score = 0;
		// robots-txt (weight 12) excluded from current, current denominator = 87-12=75
		expect(calculateCurrentReadiness(checks)).toBe(100);
		expect(calculateFutureReadiness(checks)).toBe(100);
	});

	it("returns 0 for empty checks", () => {
		expect(calculateCurrentReadiness([])).toBe(0);
		expect(calculateFutureReadiness([])).toBe(0);
	});

	it("calculateScoreBreakdown includes split scores", () => {
		const checks = makeAllChecks(80);
		const breakdown = calculateScoreBreakdown(checks);
		expect(breakdown.currentReadiness).toBe(80);
		expect(breakdown.futureReadiness).toBe(80);
	});
});

describe("calculateComparison", () => {
	it("identical scans produce all ties", () => {
		const primary = makeAllChecks(75);
		const competitor = makeAllChecks(75);
		const result = calculateComparison(primary, competitor);

		expect(result.summary.overallDelta).toBe(0);
		expect(result.summary.checksWon).toBe(0);
		expect(result.summary.checksLost).toBe(0);
		expect(result.summary.checksTied).toBe(14);
		for (const entry of result.checkEntries) {
			expect(entry.delta).toBe(0);
			expect(entry.result).toBe("tied");
		}
	});

	it("primary wins all checks", () => {
		const primary = makeAllChecks(90);
		const competitor = makeAllChecks(30);
		const result = calculateComparison(primary, competitor);

		expect(result.summary.checksWon).toBe(14);
		expect(result.summary.checksLost).toBe(0);
		expect(result.summary.overallDelta).toBe(60);
	});

	it("competitor wins all checks", () => {
		const primary = makeAllChecks(20);
		const competitor = makeAllChecks(80);
		const result = calculateComparison(primary, competitor);

		expect(result.summary.checksLost).toBe(14);
		expect(result.summary.checksWon).toBe(0);
		expect(result.summary.overallDelta).toBe(-60);
	});

	it("mixed results with correct counts", () => {
		const primary = makeAllChecks(50);
		const competitor = makeAllChecks(50);
		// Primary wins on robots-txt
		getCheck(primary, "robots-txt").score = 90;
		// Competitor wins on llms-txt
		getCheck(competitor, "llms-txt").score = 90;

		const result = calculateComparison(primary, competitor);
		expect(result.summary.checksWon).toBe(1);
		expect(result.summary.checksLost).toBe(1);
		expect(result.summary.checksTied).toBe(12);

		const robotsDelta = result.checkEntries.find((e) => e.checkId === "robots-txt");
		expect(robotsDelta?.delta).toBe(40);
		expect(robotsDelta?.result).toBe("won");

		const llmsDelta = result.checkEntries.find((e) => e.checkId === "llms-txt");
		expect(llmsDelta?.delta).toBe(-40);
		expect(llmsDelta?.result).toBe("lost");
	});

	it("handles empty arrays", () => {
		const result = calculateComparison([], []);
		expect(result.checkEntries).toHaveLength(0);
		expect(result.summary.overallDelta).toBe(0);
		expect(result.summary.checksWon).toBe(0);
	});

	it("excludes error-status checks", () => {
		const primary = makeAllChecks(100);
		const competitor = makeAllChecks(50);
		getCheck(primary, "robots-txt").status = "error";

		const result = calculateComparison(primary, competitor);
		// robots-txt excluded — only 13 checks compared
		expect(result.checkEntries).toHaveLength(13);
		expect(result.checkEntries.find((e) => e.checkId === "robots-txt")).toBeUndefined();
	});

	it("only compares checks present in both arrays", () => {
		const primary = [makeCheck({ id: "robots-txt", score: 80 })];
		const competitor = [makeCheck({ id: "llms-txt", score: 90 })];

		const result = calculateComparison(primary, competitor);
		// No common checks
		expect(result.checkEntries).toHaveLength(0);
		expect(result.summary.checksTied).toBe(0);
	});

	it("computes category comparison correctly", () => {
		const primary = [
			makeCheck({ id: "robots-txt", score: 100 }),
			makeCheck({ id: "llms-txt", score: 80 }),
		];
		const competitor = [
			makeCheck({ id: "robots-txt", score: 50 }),
			makeCheck({ id: "llms-txt", score: 30 }),
		];

		const result = calculateComparison(primary, competitor);
		const readability = result.categoryEntries.find((e) => e.category === "readability");
		expect(readability?.result).toBe("won");

		// interactivity has no weighted checks → both null → tied
		const interactivity = result.categoryEntries.find((e) => e.category === "interactivity");
		expect(interactivity?.result).toBe("tied");
	});
});

describe("scoring invariants", () => {
	it("overallScore is always 0-100", () => {
		for (const score of [0, 25, 50, 75, 100]) {
			const result = calculateOverallScore(makeAllChecks(score));
			expect(result).toBeGreaterThanOrEqual(0);
			expect(result).toBeLessThanOrEqual(100);
		}
	});

	it("readinessLevel is always 0-3", () => {
		for (const score of [0, 25, 50, 75, 100]) {
			const checks = makeAllChecks(score);
			const overall = calculateOverallScore(checks);
			const level = calculateReadinessLevel(overall, checks);
			expect(level).toBeGreaterThanOrEqual(0);
			expect(level).toBeLessThanOrEqual(3);
		}
	});

	it("higher scores never decrease overall score", () => {
		const low = calculateOverallScore(makeAllChecks(30));
		const high = calculateOverallScore(makeAllChecks(70));
		expect(high).toBeGreaterThanOrEqual(low);
	});

	it("CHECK_WEIGHTS sum to exactly 100", () => {
		const total = Object.values(CHECK_WEIGHTS).reduce((sum, w) => sum + w, 0);
		expect(total).toBe(100);
	});
});

// ── Transactional Category & Warn Semantics (Issue #46) ─────

describe("transactional category (Issue #46)", () => {
	it("transactional levelScore is null when no transactional checks exist", () => {
		const checks = makeAllChecks(80);
		const scores = calculateLevelScores(checks);
		expect(scores.transactional).toBeNull();
		// readability has weighted checks, interactivity has weight=0 checks → null
		expect(scores.readability).toBe(80);
		expect(scores.interactivity).toBeNull();
	});

	it("null transactional does not inflate overallScore", () => {
		// overallScore uses CHECK_WEIGHTS (per-check), not category scores
		const allZero = calculateOverallScore(makeAllChecks(0));
		expect(allZero).toBe(0);
		const allHundred = calculateOverallScore(makeAllChecks(100));
		expect(allHundred).toBe(100);
	});

	it("null transactional does not affect readinessLevel gating", () => {
		// gates use per-check scores, not category-level scores
		const checks = makeAllChecks(100);
		expect(calculateReadinessLevel(90, checks)).toBe(3);
	});

	it("ScoreBreakdown includes null transactional in levelScores", () => {
		const breakdown = calculateScoreBreakdown(makeAllChecks(60));
		expect(breakdown.levelScores.transactional).toBeNull();
		expect(breakdown.levelScores.readability).toBe(60);
		expect(breakdown.levelScores.interactivity).toBeNull();
	});
});

describe("warn status scoring semantics (Issue #46)", () => {
	it("warn checks contribute their numeric score to the weighted average", () => {
		const checks = [makeCheck({ id: "robots-txt", status: "warn", score: 60 })];
		expect(calculateOverallScore(checks)).toBe(60);
	});

	it("status field has no influence on score calculation", () => {
		const withWarn = [makeCheck({ id: "robots-txt", status: "warn", score: 60 })];
		const withPass = [makeCheck({ id: "robots-txt", status: "pass", score: 60 })];
		const withFail = [makeCheck({ id: "robots-txt", status: "fail", score: 60 })];
		expect(calculateOverallScore(withWarn)).toBe(60);
		expect(calculateOverallScore(withPass)).toBe(60);
		expect(calculateOverallScore(withFail)).toBe(60);
	});

	it("warn status on gate check does not affect gating (only score matters)", () => {
		const checks = makeAllChecks(100);
		// Set all gate checks to warn status but keep high scores
		for (const check of checks) {
			check.status = "warn";
		}
		expect(calculateReadinessLevel(90, checks)).toBe(3);
	});
});
