import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	auditQueries: {
		getSubscriptionEventsByUserId: vi.fn(),
		createAuditLog: vi.fn().mockResolvedValue({}),
	},
	guaranteeQueries: {
		countClaimsForUser: vi.fn(),
	},
}));

const { auditQueries, guaranteeQueries } = await import("@beacon/db");
const {
	checkPlanEligible,
	checkFirstSignup,
	checkNoDowngrade,
	checkNoResubscription,
	checkDachRegion,
	isRuleEnabled,
} = await import("../../guarantee/rules.js");

const baseCtx = {
	tx: {} as never,
	userId: "u1",
	plan: "pro" as const,
	previousPlan: null,
	subscriptionId: "sub_1",
	stripeCustomerId: "cus_1",
};

describe("guarantee rules", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.GUARANTEE_RULE_PLAN_ELIGIBLE = undefined;
		process.env.GUARANTEE_RULE_FIRST_SIGNUP = undefined;
	});

	describe("checkPlanEligible", () => {
		it("passes for pro/agency/enterprise", () => {
			for (const plan of ["pro", "agency", "enterprise"] as const) {
				expect(checkPlanEligible({ ...baseCtx, plan }).pass).toBe(true);
			}
		});
		it("fails for free/starter", () => {
			for (const plan of ["free", "starter"] as const) {
				const r = checkPlanEligible({ ...baseCtx, plan });
				expect(r.pass).toBe(false);
				expect(r.reason).toContain(plan);
			}
		});
	});

	describe("checkFirstSignup", () => {
		it("passes when user has no prior claims", async () => {
			vi.mocked(guaranteeQueries.countClaimsForUser).mockResolvedValue(0);
			expect((await checkFirstSignup(baseCtx)).pass).toBe(true);
		});
		it("fails when user has a prior claim", async () => {
			vi.mocked(guaranteeQueries.countClaimsForUser).mockResolvedValue(2);
			const r = await checkFirstSignup(baseCtx);
			expect(r.pass).toBe(false);
			expect(r.reason).toContain("2");
		});
	});

	describe("checkNoDowngrade", () => {
		it("passes when previousPlan is null (new signup)", () => {
			expect(checkNoDowngrade(baseCtx).pass).toBe(true);
		});
		it("passes when upgrading", () => {
			expect(checkNoDowngrade({ ...baseCtx, plan: "agency", previousPlan: "pro" }).pass).toBe(true);
		});
		it("passes when plan is unchanged", () => {
			expect(checkNoDowngrade({ ...baseCtx, plan: "pro", previousPlan: "pro" }).pass).toBe(true);
		});
		it("fails when downgrading", () => {
			const r = checkNoDowngrade({ ...baseCtx, plan: "pro", previousPlan: "agency" });
			expect(r.pass).toBe(false);
			expect(r.reason).toContain("agency");
			expect(r.reason).toContain("pro");
		});
	});

	describe("checkNoResubscription", () => {
		it("passes when no prior subscription_deleted events", async () => {
			vi.mocked(auditQueries.getSubscriptionEventsByUserId).mockResolvedValue([
				{ eventType: "customer.subscription.updated" } as never,
			]);
			expect((await checkNoResubscription(baseCtx)).pass).toBe(true);
		});
		it("fails when the user has ever canceled a subscription", async () => {
			vi.mocked(auditQueries.getSubscriptionEventsByUserId).mockResolvedValue([
				{ eventType: "customer.subscription.deleted" } as never,
			]);
			expect((await checkNoResubscription(baseCtx)).pass).toBe(false);
		});
	});

	describe("checkDachRegion", () => {
		it("fails closed when Stripe client is missing", async () => {
			const r = await checkDachRegion(baseCtx);
			expect(r.pass).toBe(false);
			expect(r.reason).toContain("unavailable");
		});
		it("passes for DACH countries", async () => {
			for (const country of ["DE", "AT", "CH", "de"] as const) {
				const stripe = {
					customers: {
						retrieve: vi.fn().mockResolvedValue({
							deleted: false,
							address: { country },
						}),
					},
				};
				const r = await checkDachRegion({ ...baseCtx, stripe: stripe as never });
				expect(r.pass).toBe(true);
			}
		});
		it("fails for non-DACH countries", async () => {
			const stripe = {
				customers: {
					retrieve: vi.fn().mockResolvedValue({
						deleted: false,
						address: { country: "US" },
					}),
				},
			};
			const r = await checkDachRegion({ ...baseCtx, stripe: stripe as never });
			expect(r.pass).toBe(false);
			expect(r.reason).toContain("US");
		});
		it("fails when customer has no address", async () => {
			const stripe = {
				customers: {
					retrieve: vi.fn().mockResolvedValue({ deleted: false }),
				},
			};
			const r = await checkDachRegion({ ...baseCtx, stripe: stripe as never });
			expect(r.pass).toBe(false);
		});
		it("falls back to shipping address when billing address missing", async () => {
			const stripe = {
				customers: {
					retrieve: vi.fn().mockResolvedValue({
						deleted: false,
						shipping: { address: { country: "AT" } },
					}),
				},
			};
			const r = await checkDachRegion({ ...baseCtx, stripe: stripe as never });
			expect(r.pass).toBe(true);
		});
	});

	describe("isRuleEnabled", () => {
		it("returns true by default", () => {
			expect(isRuleEnabled("plan_eligible")).toBe(true);
		});
		it("returns false only when env flag is explicitly 'off'", () => {
			process.env.GUARANTEE_RULE_PLAN_ELIGIBLE = "off";
			expect(isRuleEnabled("plan_eligible")).toBe(false);
			process.env.GUARANTEE_RULE_PLAN_ELIGIBLE = "on";
			expect(isRuleEnabled("plan_eligible")).toBe(true);
			process.env.GUARANTEE_RULE_PLAN_ELIGIBLE = "";
			expect(isRuleEnabled("plan_eligible")).toBe(true);
		});
	});
});
