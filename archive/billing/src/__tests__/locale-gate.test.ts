import { describe, expect, it } from "vitest";
import { canAddLocale, canUseRedditTracking, checkLocaleQuota } from "../guards.js";

describe("checkLocaleQuota", () => {
	it("allows the first locale on free plan (limit = 1)", () => {
		const r = checkLocaleQuota("free", { localeCount: 0 });
		expect(r.allowed).toBe(true);
		expect(r.limit).toBe(1);
		expect(r.remaining).toBe(1);
	});

	it("denies a second locale on free plan", () => {
		const r = checkLocaleQuota("free", { localeCount: 1 });
		expect(r.allowed).toBe(false);
		expect(r.upgradeTo).toBe("agency"); // first plan with > 1 locale
		expect(r.reason).toContain("Locale-Limit erreicht");
	});

	it("denies a second locale on starter plan", () => {
		const r = checkLocaleQuota("starter", { localeCount: 1 });
		expect(r.allowed).toBe(false);
	});

	it("denies a second locale on pro plan", () => {
		const r = checkLocaleQuota("pro", { localeCount: 1 });
		expect(r.allowed).toBe(false);
		expect(r.upgradeTo).toBe("agency");
	});

	it("allows up to 5 locales on agency plan", () => {
		expect(checkLocaleQuota("agency", { localeCount: 4 }).allowed).toBe(true);
		expect(checkLocaleQuota("agency", { localeCount: 5 }).allowed).toBe(false);
	});

	it("allows unlimited locales on enterprise plan", () => {
		expect(checkLocaleQuota("enterprise", { localeCount: 100 }).allowed).toBe(true);
		expect(checkLocaleQuota("enterprise", { localeCount: 100 }).remaining).toBeNull();
	});

	it("includes German upgrade hint when denied", () => {
		const r = checkLocaleQuota("starter", { localeCount: 1 });
		expect(r.reason).toContain("Bitte upgraden");
	});
});

describe("canAddLocale (boolean)", () => {
	it("matches checkLocaleQuota.allowed", () => {
		expect(canAddLocale("free", { localeCount: 0 })).toBe(true);
		expect(canAddLocale("free", { localeCount: 1 })).toBe(false);
		expect(canAddLocale("agency", { localeCount: 4 })).toBe(true);
		expect(canAddLocale("agency", { localeCount: 5 })).toBe(false);
		expect(canAddLocale("enterprise", { localeCount: 99 })).toBe(true);
	});
});

describe("canUseRedditTracking (#204)", () => {
	it("denied on free/starter/pro (redditTracking=false)", () => {
		expect(canUseRedditTracking("free")).toBe(false);
		expect(canUseRedditTracking("starter")).toBe(false);
		expect(canUseRedditTracking("pro")).toBe(false);
	});

	it("allowed on agency + enterprise", () => {
		expect(canUseRedditTracking("agency")).toBe(true);
		expect(canUseRedditTracking("enterprise")).toBe(true);
	});
});
