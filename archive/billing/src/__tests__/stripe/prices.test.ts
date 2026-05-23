import { afterEach, describe, expect, it, vi } from "vitest";
import { getStripePriceId, loadStripePriceMap, lookupPlanByPriceId } from "../../stripe/prices.js";
import { BillingError } from "../../stripe/types.js";
import { MOCK_PRICE_MAP } from "./_fixtures.js";

describe("loadStripePriceMap", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("throws when env vars are missing", () => {
		vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "");
		expect(() => loadStripePriceMap()).toThrow(BillingError);
	});

	it("loads map when all env vars are set", () => {
		vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "price_1");
		vi.stubEnv("STRIPE_PRICE_STARTER_YEARLY", "price_2");
		vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_3");
		vi.stubEnv("STRIPE_PRICE_PRO_YEARLY", "price_4");
		vi.stubEnv("STRIPE_PRICE_AGENCY_MONTHLY", "price_5");
		vi.stubEnv("STRIPE_PRICE_AGENCY_YEARLY", "price_6");
		vi.stubEnv("STRIPE_PRICE_ENTERPRISE_MONTHLY", "price_7");

		const map = loadStripePriceMap();
		expect(map.starter.monthly).toBe("price_1");
		expect(map.pro.yearly).toBe("price_4");
		expect(map.enterprise.monthly).toBe("price_7");
	});

	it("throws on duplicate price IDs", () => {
		vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "price_same");
		vi.stubEnv("STRIPE_PRICE_STARTER_YEARLY", "price_same");
		vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_3");
		vi.stubEnv("STRIPE_PRICE_PRO_YEARLY", "price_4");
		vi.stubEnv("STRIPE_PRICE_AGENCY_MONTHLY", "price_5");
		vi.stubEnv("STRIPE_PRICE_AGENCY_YEARLY", "price_6");
		vi.stubEnv("STRIPE_PRICE_ENTERPRISE_MONTHLY", "price_7");

		expect(() => loadStripePriceMap()).toThrow("Doppelte");
	});
});

describe("getStripePriceId", () => {
	it("returns correct price ID for starter monthly", () => {
		expect(getStripePriceId(MOCK_PRICE_MAP, "starter", "monthly")).toBe("price_starter_m");
	});

	it("returns correct price ID for pro yearly", () => {
		expect(getStripePriceId(MOCK_PRICE_MAP, "pro", "yearly")).toBe("price_pro_y");
	});

	it("throws for free plan", () => {
		expect(() => getStripePriceId(MOCK_PRICE_MAP, "free", "monthly")).toThrow(BillingError);
	});

	it("throws for enterprise yearly", () => {
		expect(() => getStripePriceId(MOCK_PRICE_MAP, "enterprise", "yearly")).toThrow(BillingError);
	});

	it("returns correct price ID for agency monthly", () => {
		expect(getStripePriceId(MOCK_PRICE_MAP, "agency", "monthly")).toBe("price_agency_m");
	});

	it("returns correct price ID for enterprise monthly", () => {
		expect(getStripePriceId(MOCK_PRICE_MAP, "enterprise", "monthly")).toBe("price_enterprise_m");
	});

	it("throws BillingError with INVALID_PLAN code for free plan", () => {
		try {
			getStripePriceId(MOCK_PRICE_MAP, "free", "monthly");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect((e as BillingError).code).toBe("INVALID_PLAN");
		}
	});
});

describe("lookupPlanByPriceId", () => {
	it("returns plan and interval for known price ID", () => {
		expect(lookupPlanByPriceId(MOCK_PRICE_MAP, "price_pro_m")).toEqual({
			plan: "pro",
			interval: "monthly",
		});
	});

	it("returns null for unknown price ID", () => {
		expect(lookupPlanByPriceId(MOCK_PRICE_MAP, "price_unknown")).toBeNull();
	});

	it("finds enterprise monthly", () => {
		expect(lookupPlanByPriceId(MOCK_PRICE_MAP, "price_enterprise_m")).toEqual({
			plan: "enterprise",
			interval: "monthly",
		});
	});

	it("returns null for empty string price ID", () => {
		expect(lookupPlanByPriceId(MOCK_PRICE_MAP, "")).toBeNull();
	});
});
