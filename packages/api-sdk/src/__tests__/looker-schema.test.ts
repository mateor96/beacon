import { describe, expect, it } from "vitest";
import {
	DIMENSIONS,
	LOOKER_FIELD_IDS,
	METRICS,
	formatLookerDate,
	getDefaultFieldIds,
	getFieldById,
	validateFieldIds,
} from "../looker/schema.js";

describe("Looker schema (#193)", () => {
	it("exports at least 5 dimensions and 5 metrics", () => {
		expect(DIMENSIONS.length).toBeGreaterThanOrEqual(5);
		expect(METRICS.length).toBeGreaterThanOrEqual(5);
	});

	it("every dimension has kind=DIMENSION", () => {
		for (const d of DIMENSIONS) expect(d.kind).toBe("DIMENSION");
	});

	it("every metric has kind=METRIC and an aggregation", () => {
		for (const m of METRICS) {
			expect(m.kind).toBe("METRIC");
			expect(m.aggregation).toBeTruthy();
		}
	});

	it("field ids are unique", () => {
		const seen = new Set<string>();
		for (const id of LOOKER_FIELD_IDS) {
			expect(seen.has(id)).toBe(false);
			seen.add(id);
		}
	});

	it("every field references a known Beacon source table", () => {
		const validSources = new Set([
			"scans",
			"citations",
			"competitors",
			"domain_locales",
			"locales",
			"fixes",
		]);
		for (const f of [...DIMENSIONS, ...METRICS]) {
			expect(validSources.has(f.source)).toBe(true);
		}
	});

	it("getDefaultFieldIds returns at least one of each kind", () => {
		const defaults = getDefaultFieldIds();
		expect(defaults.length).toBeGreaterThan(0);
		const hasDimension = defaults.some((id) => DIMENSIONS.find((d) => d.id === id));
		const hasMetric = defaults.some((id) => METRICS.find((m) => m.id === id));
		expect(hasDimension && hasMetric).toBe(true);
	});

	it("getFieldById returns the correct spec", () => {
		const f = getFieldById("readiness_score");
		expect(f.kind).toBe("METRIC");
		expect(f.dataType).toBe("NUMBER");
	});

	it("getFieldById throws on unknown ids", () => {
		expect(() => getFieldById("nope")).toThrow();
	});

	it("validateFieldIds returns unknown ids", () => {
		expect(validateFieldIds(["domain", "nope", "scan_date", "also_nope"])).toEqual([
			"nope",
			"also_nope",
		]);
	});

	it("validateFieldIds returns [] for all known ids", () => {
		expect(validateFieldIds(LOOKER_FIELD_IDS)).toEqual([]);
	});
});

describe("formatLookerDate", () => {
	it("formats a Date as YYYYMMDD", () => {
		expect(formatLookerDate(new Date("2026-04-21T12:00:00Z"))).toBe("20260421");
	});

	it("formats an ISO string", () => {
		expect(formatLookerDate("2026-01-05T00:00:00Z")).toBe("20260105");
	});

	it("pads single-digit months and days", () => {
		expect(formatLookerDate("2026-03-05T12:00:00Z")).toBe("20260305");
	});

	it("returns null for null/undefined", () => {
		expect(formatLookerDate(null)).toBeNull();
		expect(formatLookerDate(undefined)).toBeNull();
	});

	it("returns null for invalid dates", () => {
		expect(formatLookerDate("not a date")).toBeNull();
	});
});
