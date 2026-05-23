/**
 * Referral fraud detection (#287). Pure rule functions that take a
 * normalised input shape and return zero-or-more flags. The caller
 * (typically a webhook handler or a periodic cron) persists the flags
 * via the DB layer and triggers auto-suspend after the threshold is hit.
 */

export type FraudRuleId = "self_referral" | "cookie_stuffing" | "fake_signup_churn" | "velocity";

export interface FraudFlag {
	rule: FraudRuleId;
	message: string;
	details?: Record<string, unknown>;
}

// ── Inputs (decoupled from DB types) ─────────────────────────

export interface SelfReferralCheckInput {
	affiliateUserEmail: string;
	affiliateUserIp?: string | null;
	referredUserEmail: string;
	referredUserIp?: string | null;
	stripeFingerprint?: string | null;
	affiliateStripeFingerprint?: string | null;
}

export interface CookieStuffingCheckInput {
	clicksLast24h: number;
	conversionsLast24h: number;
}

export interface FakeSignupCheckInput {
	totalConversionsLast30d: number;
	churnedWithin48hLast30d: number;
}

export interface VelocityCheckInput {
	conversionsLast24h: number;
}

// ── Thresholds ────────────────────────────────────────────────

export const FRAUD_THRESHOLDS = {
	cookieStuffingClicksPerDay: 500,
	cookieStuffingConversionRatio: 0.005, // <0.5% conversion rate
	fakeSignupChurnRate: 0.3, // 30% churn-within-48h triggers
	fakeSignupMinSample: 10,
	velocityConversionsPerDay: 20,
	autoSuspendFlagCount: 3,
} as const;

// ── Rule functions ───────────────────────────────────────────

function emailDomain(email: string): string {
	return email.toLowerCase().split("@")[1] ?? "";
}

export function checkSelfReferral(input: SelfReferralCheckInput): FraudFlag | null {
	const aDomain = emailDomain(input.affiliateUserEmail);
	const rDomain = emailDomain(input.referredUserEmail);
	const matches: string[] = [];
	if (aDomain && aDomain === rDomain) matches.push("email_domain");
	if (
		input.affiliateUserIp &&
		input.referredUserIp &&
		input.affiliateUserIp === input.referredUserIp
	) {
		matches.push("ip_address");
	}
	if (
		input.stripeFingerprint &&
		input.affiliateStripeFingerprint &&
		input.stripeFingerprint === input.affiliateStripeFingerprint
	) {
		matches.push("payment_fingerprint");
	}
	if (matches.length === 0) return null;
	return {
		rule: "self_referral",
		message: `Selbst-Referral erkannt (${matches.join(", ")}).`,
		details: { matches },
	};
}

export function checkCookieStuffing(input: CookieStuffingCheckInput): FraudFlag | null {
	if (input.clicksLast24h < FRAUD_THRESHOLDS.cookieStuffingClicksPerDay) return null;
	const ratio = input.clicksLast24h > 0 ? input.conversionsLast24h / input.clicksLast24h : 0;
	if (ratio >= FRAUD_THRESHOLDS.cookieStuffingConversionRatio) return null;
	return {
		rule: "cookie_stuffing",
		message: `Cookie-Stuffing-Verdacht: ${input.clicksLast24h} Klicks bei nur ${input.conversionsLast24h} Conversions.`,
		details: {
			clicksLast24h: input.clicksLast24h,
			conversionsLast24h: input.conversionsLast24h,
			ratio,
		},
	};
}

export function checkFakeSignup(input: FakeSignupCheckInput): FraudFlag | null {
	if (input.totalConversionsLast30d < FRAUD_THRESHOLDS.fakeSignupMinSample) return null;
	const churnRate = input.churnedWithin48hLast30d / input.totalConversionsLast30d;
	if (churnRate < FRAUD_THRESHOLDS.fakeSignupChurnRate) return null;
	return {
		rule: "fake_signup_churn",
		message: `Fake-Signup-Verdacht: ${(churnRate * 100).toFixed(1)}% der Conversions kündigen <48h.`,
		details: {
			totalConversionsLast30d: input.totalConversionsLast30d,
			churnedWithin48hLast30d: input.churnedWithin48hLast30d,
			churnRate,
		},
	};
}

export function checkVelocity(input: VelocityCheckInput): FraudFlag | null {
	if (input.conversionsLast24h <= FRAUD_THRESHOLDS.velocityConversionsPerDay) return null;
	return {
		rule: "velocity",
		message: `Velocity-Verstoss: ${input.conversionsLast24h} Conversions in 24h (Schwelle ${FRAUD_THRESHOLDS.velocityConversionsPerDay}).`,
		details: { conversionsLast24h: input.conversionsLast24h },
	};
}

/**
 * Returns true when the affiliate's accumulated flag count meets the
 * auto-suspend threshold. Caller is responsible for transitioning the
 * affiliate row to status='suspended'.
 */
export function shouldAutoSuspend(flagCount: number): boolean {
	return flagCount >= FRAUD_THRESHOLDS.autoSuspendFlagCount;
}
