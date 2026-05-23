import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	auditQueries: {
		getSubscriptionEventsByUserId: vi.fn().mockResolvedValue([]),
		createAuditLog: vi.fn().mockResolvedValue({}),
	},
	guaranteeQueries: {
		countClaimsForUser: vi.fn().mockResolvedValue(0),
	},
}));

const { auditQueries, guaranteeQueries } = await import("@beacon/db");
const { checkGuaranteeEligibility } = await import("../../guarantee/eligibility.js");

function makeStripe(country = "DE") {
	return {
		customers: {
			retrieve: vi.fn().mockResolvedValue({
				deleted: false,
				address: { country },
			}),
		},
	};
}

describe("checkGuaranteeEligibility", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auditQueries.getSubscriptionEventsByUserId).mockResolvedValue([]);
		vi.mocked(guaranteeQueries.countClaimsForUser).mockResolvedValue(0);
		for (const key of [
			"GUARANTEE_RULE_PLAN_ELIGIBLE",
			"GUARANTEE_RULE_FIRST_SIGNUP",
			"GUARANTEE_RULE_NO_DOWNGRADE",
			"GUARANTEE_RULE_NO_RESUBSCRIPTION",
			"GUARANTEE_RULE_DACH_REGION",
		]) {
			delete process.env[key];
		}
	});

	it("returns eligible=true when all rules pass", async () => {
		const res = await checkGuaranteeEligibility({
			tx: {} as never,
			userId: "u1",
			plan: "pro",
			previousPlan: null,
			subscriptionId: "sub_1",
			stripeCustomerId: "cus_1",
			stripe: makeStripe("DE") as never,
		});
		expect(res.eligible).toBe(true);
		expect(res.failedRule).toBeNull();
	});

	it("short-circuits on first failing rule", async () => {
		const res = await checkGuaranteeEligibility({
			tx: {} as never,
			userId: "u1",
			plan: "free",
			previousPlan: null,
			subscriptionId: "sub_1",
			stripeCustomerId: "cus_1",
			stripe: makeStripe("DE") as never,
		});
		expect(res.eligible).toBe(false);
		expect(res.failedRule).toBe("plan_eligible");
		// first_signup etc should not have been reached
		expect(guaranteeQueries.countClaimsForUser).not.toHaveBeenCalled();
	});

	it("rejects prior claim via first_signup rule", async () => {
		vi.mocked(guaranteeQueries.countClaimsForUser).mockResolvedValue(1);
		const res = await checkGuaranteeEligibility({
			tx: {} as never,
			userId: "u1",
			plan: "pro",
			previousPlan: null,
			subscriptionId: "sub_2",
			stripeCustomerId: "cus_1",
			stripe: makeStripe("DE") as never,
		});
		expect(res.eligible).toBe(false);
		expect(res.failedRule).toBe("first_signup");
	});

	it("rejects downgrade via no_downgrade rule", async () => {
		const res = await checkGuaranteeEligibility({
			tx: {} as never,
			userId: "u1",
			plan: "pro",
			previousPlan: "agency",
			subscriptionId: "sub_1",
			stripeCustomerId: "cus_1",
			stripe: makeStripe("DE") as never,
		});
		expect(res.eligible).toBe(false);
		expect(res.failedRule).toBe("no_downgrade");
	});

	it("rejects re-subscription when prior cancellation exists", async () => {
		vi.mocked(auditQueries.getSubscriptionEventsByUserId).mockResolvedValue([
			{ eventType: "customer.subscription.deleted" } as never,
		]);
		const res = await checkGuaranteeEligibility({
			tx: {} as never,
			userId: "u1",
			plan: "pro",
			previousPlan: null,
			subscriptionId: "sub_2",
			stripeCustomerId: "cus_1",
			stripe: makeStripe("DE") as never,
		});
		expect(res.eligible).toBe(false);
		expect(res.failedRule).toBe("no_resubscription");
	});

	it("rejects non-DACH billing country", async () => {
		const res = await checkGuaranteeEligibility({
			tx: {} as never,
			userId: "u1",
			plan: "pro",
			previousPlan: null,
			subscriptionId: "sub_1",
			stripeCustomerId: "cus_1",
			stripe: makeStripe("US") as never,
		});
		expect(res.eligible).toBe(false);
		expect(res.failedRule).toBe("dach_region");
	});

	it("skips a rule when its env flag is 'off'", async () => {
		process.env.GUARANTEE_RULE_DACH_REGION = "off";
		const res = await checkGuaranteeEligibility({
			tx: {} as never,
			userId: "u1",
			plan: "pro",
			previousPlan: null,
			subscriptionId: "sub_1",
			stripeCustomerId: "cus_1",
			stripe: makeStripe("US") as never,
		});
		expect(res.eligible).toBe(true);
	});

	it("writes an audit log entry on rejection", async () => {
		await checkGuaranteeEligibility({
			tx: {} as never,
			userId: "u1",
			plan: "free",
			previousPlan: null,
			subscriptionId: "sub_1",
			stripeCustomerId: "cus_1",
			stripe: makeStripe("DE") as never,
		});
		expect(auditQueries.createAuditLog).toHaveBeenCalledWith(
			{},
			expect.objectContaining({
				userId: "u1",
				action: "guarantee_eligibility_rejected",
				details: expect.objectContaining({ ruleId: "plan_eligible" }),
			}),
		);
	});
});
