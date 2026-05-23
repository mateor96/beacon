import { describe, expect, it } from "vitest";
import {
	AI_CRAWLERS,
	CHECK_METADATA_MAP,
	CHECK_REGISTRY,
	CHECK_WEIGHTS,
	CURRENT_READINESS_CHECK_IDS,
	FUTURE_READINESS_CHECK_IDS,
	LEVEL_GATE_CHECKS,
	LEVEL_NAMES,
	LEVEL_THRESHOLDS,
	PLAN_RETENTION_DAYS,
	SEVERITY_POINTS,
	scoreToLevel,
} from "../constants";
import { CHECK_IDS } from "../types";

describe("SEVERITY_POINTS", () => {
	it("has correct values for all severities", () => {
		expect(SEVERITY_POINTS.critical).toBe(25);
		expect(SEVERITY_POINTS.important).toBe(10);
		expect(SEVERITY_POINTS["nice-to-have"]).toBe(5);
	});
});

describe("CHECK_REGISTRY", () => {
	it("has exactly 14 entries", () => {
		expect(CHECK_REGISTRY).toHaveLength(14);
	});

	it("every entry has a valid CheckId", () => {
		for (const check of CHECK_REGISTRY) {
			expect(CHECK_IDS).toContain(check.id);
		}
	});

	it("matches the exact registry snapshot", () => {
		expect(CHECK_REGISTRY).toMatchSnapshot();
	});
});

describe("CHECK_METADATA_MAP", () => {
	it("has an entry for every CHECK_ID", () => {
		for (const id of CHECK_IDS) {
			expect(CHECK_METADATA_MAP[id]).toBeDefined();
			expect(CHECK_METADATA_MAP[id].id).toBe(id);
		}
	});

	it("has no extra entries beyond CHECK_IDS", () => {
		expect(Object.keys(CHECK_METADATA_MAP)).toHaveLength(CHECK_IDS.length);
	});
});

describe("CHECK_REGISTRY immutability", () => {
	it("array is frozen", () => {
		expect(Object.isFrozen(CHECK_REGISTRY)).toBe(true);
	});

	it("every entry is frozen", () => {
		for (const entry of CHECK_REGISTRY) {
			expect(Object.isFrozen(entry)).toBe(true);
		}
	});

	it("rejects mutation of entry properties", () => {
		expect(() => {
			(CHECK_REGISTRY[0] as unknown as { name: string }).name = "tampered";
		}).toThrow(TypeError);
	});
});

describe("CHECK_METADATA_MAP immutability", () => {
	it("map is frozen", () => {
		expect(Object.isFrozen(CHECK_METADATA_MAP)).toBe(true);
	});

	it("every value is frozen", () => {
		for (const id of CHECK_IDS) {
			expect(Object.isFrozen(CHECK_METADATA_MAP[id])).toBe(true);
		}
	});

	it("rejects adding new keys", () => {
		expect(() => {
			(CHECK_METADATA_MAP as unknown as Record<string, unknown>)["fake-id"] = {};
		}).toThrow(TypeError);
	});

	it("rejects mutation of entry properties", () => {
		expect(() => {
			(CHECK_METADATA_MAP["llms-txt"] as unknown as { severity: string }).severity = "nice-to-have";
		}).toThrow(TypeError);
	});
});

describe("SEVERITY_POINTS immutability", () => {
	it("is frozen", () => {
		expect(Object.isFrozen(SEVERITY_POINTS)).toBe(true);
	});

	it("rejects mutation", () => {
		expect(() => {
			(SEVERITY_POINTS as unknown as Record<string, number>).critical = 999;
		}).toThrow(TypeError);
	});
});

describe("CHECK_WEIGHTS immutability", () => {
	it("is frozen", () => {
		expect(Object.isFrozen(CHECK_WEIGHTS)).toBe(true);
	});

	it("rejects mutation", () => {
		expect(() => {
			(CHECK_WEIGHTS as unknown as Record<string, number>)["llms-txt"] = 999;
		}).toThrow(TypeError);
	});
});

describe("LEVEL_GATE_CHECKS immutability", () => {
	it("is frozen", () => {
		expect(Object.isFrozen(LEVEL_GATE_CHECKS)).toBe(true);
	});

	it("inner arrays are frozen", () => {
		for (const level of [0, 1, 2, 3] as const) {
			expect(Object.isFrozen(LEVEL_GATE_CHECKS[level])).toBe(true);
		}
	});
});

describe("LEVEL_THRESHOLDS immutability", () => {
	it("is frozen", () => {
		expect(Object.isFrozen(LEVEL_THRESHOLDS)).toBe(true);
	});
});

describe("LEVEL_NAMES immutability", () => {
	it("is frozen", () => {
		expect(Object.isFrozen(LEVEL_NAMES)).toBe(true);
	});
});

describe("PLAN_RETENTION_DAYS immutability", () => {
	it("is frozen", () => {
		expect(Object.isFrozen(PLAN_RETENTION_DAYS)).toBe(true);
	});
});

describe("AI_CRAWLERS", () => {
	it("has exactly 10 entries", () => {
		expect(AI_CRAWLERS).toHaveLength(10);
	});
});

describe("CHECK_WEIGHTS", () => {
	it("has an entry for every CHECK_ID", () => {
		for (const id of CHECK_IDS) {
			expect(CHECK_WEIGHTS[id]).toBeDefined();
			expect(CHECK_WEIGHTS[id]).toBeGreaterThanOrEqual(0);
		}
	});

	it("weights sum to exactly 100", () => {
		const total = Object.values(CHECK_WEIGHTS).reduce((sum, w) => sum + w, 0);
		expect(total).toBe(100);
	});

	it("has no extra entries beyond CHECK_IDS", () => {
		expect(Object.keys(CHECK_WEIGHTS)).toHaveLength(CHECK_IDS.length);
	});
});

describe("LEVEL_GATE_CHECKS", () => {
	it("has entries for all 4 levels", () => {
		expect(LEVEL_GATE_CHECKS[0]).toBeDefined();
		expect(LEVEL_GATE_CHECKS[1]).toBeDefined();
		expect(LEVEL_GATE_CHECKS[2]).toBeDefined();
		expect(LEVEL_GATE_CHECKS[3]).toBeDefined();
	});

	it("level 0 has no gate checks", () => {
		expect(LEVEL_GATE_CHECKS[0]).toHaveLength(0);
	});

	it("all gate check IDs are valid CHECK_IDS", () => {
		for (const level of [0, 1, 2, 3] as const) {
			for (const id of LEVEL_GATE_CHECKS[level]) {
				expect(CHECK_IDS).toContain(id);
			}
		}
	});
});

describe("scoreToLevel", () => {
	it("returns level 0 for scores <= 20", () => {
		expect(scoreToLevel(0)).toBe(0);
		expect(scoreToLevel(20)).toBe(0);
	});

	it("returns level 1 for scores 21-50", () => {
		expect(scoreToLevel(21)).toBe(1);
		expect(scoreToLevel(50)).toBe(1);
	});

	it("returns level 2 for scores 51-75", () => {
		expect(scoreToLevel(51)).toBe(2);
		expect(scoreToLevel(75)).toBe(2);
	});

	it("returns level 3 for scores > 75", () => {
		expect(scoreToLevel(76)).toBe(3);
		expect(scoreToLevel(100)).toBe(3);
	});

	it("handles edge cases", () => {
		expect(scoreToLevel(-10)).toBe(0);
		expect(scoreToLevel(150)).toBe(3);
		expect(scoreToLevel(50.5)).toBe(2);
	});
});

describe("CURRENT_READINESS_CHECK_IDS and FUTURE_READINESS_CHECK_IDS", () => {
	it("union equals all CHECK_IDS", () => {
		const union = new Set([...CURRENT_READINESS_CHECK_IDS, ...FUTURE_READINESS_CHECK_IDS]);
		expect(union.size).toBe(CHECK_IDS.length);
		for (const id of CHECK_IDS) {
			expect(union.has(id)).toBe(true);
		}
	});

	it("have no overlap", () => {
		const currentSet = new Set(CURRENT_READINESS_CHECK_IDS);
		for (const id of FUTURE_READINESS_CHECK_IDS) {
			expect(currentSet.has(id)).toBe(false);
		}
	});

	it("are both frozen", () => {
		expect(Object.isFrozen(CURRENT_READINESS_CHECK_IDS)).toBe(true);
		expect(Object.isFrozen(FUTURE_READINESS_CHECK_IDS)).toBe(true);
	});
});
