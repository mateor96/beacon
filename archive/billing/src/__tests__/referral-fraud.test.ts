import { describe, expect, it } from "vitest";
import {
	FRAUD_THRESHOLDS,
	checkCookieStuffing,
	checkFakeSignup,
	checkSelfReferral,
	checkVelocity,
	shouldAutoSuspend,
} from "../referral/fraud.js";

describe("checkSelfReferral (#287)", () => {
	it("flags matching email domain", () => {
		const flag = checkSelfReferral({
			affiliateUserEmail: "x@acme.com",
			referredUserEmail: "y@acme.com",
		});
		expect(flag?.rule).toBe("self_referral");
	});

	it("flags matching IP", () => {
		const flag = checkSelfReferral({
			affiliateUserEmail: "x@a.com",
			referredUserEmail: "y@b.com",
			affiliateUserIp: "1.2.3.4",
			referredUserIp: "1.2.3.4",
		});
		expect(flag?.rule).toBe("self_referral");
	});

	it("flags matching Stripe payment fingerprint", () => {
		const flag = checkSelfReferral({
			affiliateUserEmail: "x@a.com",
			referredUserEmail: "y@b.com",
			stripeFingerprint: "fp_123",
			affiliateStripeFingerprint: "fp_123",
		});
		expect(flag?.rule).toBe("self_referral");
	});

	it("returns null when nothing matches", () => {
		expect(
			checkSelfReferral({
				affiliateUserEmail: "x@a.com",
				referredUserEmail: "y@b.com",
				affiliateUserIp: "1.1.1.1",
				referredUserIp: "2.2.2.2",
			}),
		).toBeNull();
	});

	it("ignores empty/missing IP fields", () => {
		expect(
			checkSelfReferral({
				affiliateUserEmail: "x@a.com",
				referredUserEmail: "y@b.com",
			}),
		).toBeNull();
	});
});

describe("checkCookieStuffing (#287)", () => {
	it("flags >500 clicks with <0.5% conversion rate", () => {
		const flag = checkCookieStuffing({ clicksLast24h: 1000, conversionsLast24h: 2 });
		expect(flag?.rule).toBe("cookie_stuffing");
	});

	it("does not flag when clicks below threshold", () => {
		expect(checkCookieStuffing({ clicksLast24h: 100, conversionsLast24h: 0 })).toBeNull();
	});

	it("does not flag when conversion rate is healthy", () => {
		expect(checkCookieStuffing({ clicksLast24h: 1000, conversionsLast24h: 100 })).toBeNull();
	});
});

describe("checkFakeSignup (#287)", () => {
	it("flags >30% churn-within-48h with >=10 conversions", () => {
		const flag = checkFakeSignup({
			totalConversionsLast30d: 20,
			churnedWithin48hLast30d: 8,
		});
		expect(flag?.rule).toBe("fake_signup_churn");
	});

	it("does not flag with too small a sample", () => {
		expect(checkFakeSignup({ totalConversionsLast30d: 5, churnedWithin48hLast30d: 5 })).toBeNull();
	});

	it("does not flag below 30% churn", () => {
		expect(
			checkFakeSignup({ totalConversionsLast30d: 100, churnedWithin48hLast30d: 10 }),
		).toBeNull();
	});
});

describe("checkVelocity (#287)", () => {
	it("flags >20 conversions in 24h", () => {
		const flag = checkVelocity({ conversionsLast24h: 25 });
		expect(flag?.rule).toBe("velocity");
	});

	it("does not flag at exactly the threshold", () => {
		expect(checkVelocity({ conversionsLast24h: 20 })).toBeNull();
	});
});

describe("shouldAutoSuspend (#287)", () => {
	it("returns true at exactly 3 flags", () => {
		expect(shouldAutoSuspend(3)).toBe(true);
		expect(shouldAutoSuspend(FRAUD_THRESHOLDS.autoSuspendFlagCount)).toBe(true);
	});
	it("returns false below 3", () => {
		expect(shouldAutoSuspend(0)).toBe(false);
		expect(shouldAutoSuspend(2)).toBe(false);
	});
	it("returns true above 3", () => {
		expect(shouldAutoSuspend(10)).toBe(true);
	});
});
