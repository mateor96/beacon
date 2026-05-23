import { describe, expect, it } from "vitest";
import {
	type AlertConfig,
	type EvaluationContext,
	evaluateAlert,
	isCooldownActive,
} from "../alert-evaluation.js";

function makeConfig(overrides: Partial<AlertConfig> = {}): AlertConfig {
	return { threshold: 20, cooldownMinutes: 360, ...overrides };
}

function makeCtx(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
	return {
		currentMentionCount: 10,
		previousMentionCount: 15,
		currentAvgRank: null,
		previousAvgRank: null,
		newCitationCount: 0,
		...overrides,
	};
}

describe("evaluateAlert", () => {
	// ── visibility_drop ────────────────────────────────

	describe("visibility_drop", () => {
		it("fires when drop exceeds threshold", () => {
			const result = evaluateAlert(
				"visibility_drop",
				makeConfig({ threshold: 20 }),
				makeCtx({ currentMentionCount: 5, previousMentionCount: 10 }),
			);
			expect(result.shouldFire).toBe(true);
			expect(result.changePercent).toBe(-50);
		});

		it("does NOT fire when drop is below threshold", () => {
			const result = evaluateAlert(
				"visibility_drop",
				makeConfig({ threshold: 50 }),
				makeCtx({ currentMentionCount: 8, previousMentionCount: 10 }),
			);
			expect(result.shouldFire).toBe(false);
		});

		it("does NOT fire when mentions increased", () => {
			const result = evaluateAlert(
				"visibility_drop",
				makeConfig(),
				makeCtx({ currentMentionCount: 20, previousMentionCount: 10 }),
			);
			expect(result.shouldFire).toBe(false);
		});

		it("does NOT fire when previous mentions are 0", () => {
			const result = evaluateAlert(
				"visibility_drop",
				makeConfig(),
				makeCtx({ currentMentionCount: 0, previousMentionCount: 0 }),
			);
			expect(result.shouldFire).toBe(false);
		});
	});

	// ── new_citation ───────────────────────────────────

	describe("new_citation", () => {
		it("fires when new citations detected", () => {
			const result = evaluateAlert("new_citation", makeConfig(), makeCtx({ newCitationCount: 3 }));
			expect(result.shouldFire).toBe(true);
			expect(result.reason).toContain("3");
		});

		it("does NOT fire when no new citations", () => {
			const result = evaluateAlert("new_citation", makeConfig(), makeCtx({ newCitationCount: 0 }));
			expect(result.shouldFire).toBe(false);
		});
	});

	// ── competitor_gain ────────────────────────────────

	describe("competitor_gain", () => {
		it("fires when rank drops by threshold", () => {
			const result = evaluateAlert(
				"competitor_gain",
				makeConfig({ threshold: 3 }),
				makeCtx({ currentAvgRank: 8, previousAvgRank: 3 }),
			);
			expect(result.shouldFire).toBe(true);
			expect(result.reason).toContain("5");
		});

		it("does NOT fire when rank improves", () => {
			const result = evaluateAlert(
				"competitor_gain",
				makeConfig({ threshold: 3 }),
				makeCtx({ currentAvgRank: 2, previousAvgRank: 5 }),
			);
			expect(result.shouldFire).toBe(false);
		});

		it("does NOT fire when no ranking data", () => {
			const result = evaluateAlert(
				"competitor_gain",
				makeConfig(),
				makeCtx({ currentAvgRank: null, previousAvgRank: null }),
			);
			expect(result.shouldFire).toBe(false);
		});
	});

	// ── unknown type ───────────────────────────────────

	it("returns shouldFire=false for unknown rule type", () => {
		const result = evaluateAlert("unknown_type", makeConfig(), makeCtx());
		expect(result.shouldFire).toBe(false);
	});
});

describe("isCooldownActive", () => {
	it("returns false when no lastFiredAt", () => {
		expect(isCooldownActive(makeConfig())).toBe(false);
	});

	it("returns true within cooldown window", () => {
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		expect(
			isCooldownActive(makeConfig({ lastFiredAt: fiveMinutesAgo, cooldownMinutes: 360 })),
		).toBe(true);
	});

	it("returns false after cooldown expired", () => {
		const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
		expect(isCooldownActive(makeConfig({ lastFiredAt: sevenHoursAgo, cooldownMinutes: 360 }))).toBe(
			false,
		);
	});

	it("uses default cooldown when not specified", () => {
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		expect(isCooldownActive({ lastFiredAt: oneHourAgo })).toBe(true); // default 360 min > 60 min
	});
});
