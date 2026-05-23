import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	referralQueries: {
		getConversionByReferredUser: vi.fn(),
		listCommissionsForAffiliate: vi.fn().mockResolvedValue([]),
		createCommission: vi.fn(),
	},
}));

const { referralQueries } = await import("@beacon/db");
const { recordInvoiceCommission } = await import("../../referral/recurring.js");

const fakeTx = {} as never;

describe("recordInvoiceCommission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(referralQueries.listCommissionsForAffiliate).mockResolvedValue([]);
	});

	it("returns no_conversion when user was never referred", async () => {
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue(undefined);
		const res = await recordInvoiceCommission(fakeTx, {
			referredUserId: "u1",
			plan: "pro",
			stripeInvoiceId: "in_1",
			netAmountCents: 4900,
		});
		expect(res).toEqual({ status: "no_conversion" });
	});

	it("returns conversion_not_paid when conversion is still signup", async () => {
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue({
			id: "c1",
			affiliateId: "a1",
			status: "signup",
		} as never);
		const res = await recordInvoiceCommission(fakeTx, {
			referredUserId: "u1",
			plan: "pro",
			stripeInvoiceId: "in_1",
			netAmountCents: 4900,
		});
		expect(res).toEqual({ status: "conversion_not_paid" });
	});

	it("records a pending commission on happy path", async () => {
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue({
			id: "c1",
			affiliateId: "a1",
			status: "paid",
		} as never);
		vi.mocked(referralQueries.createCommission).mockResolvedValue({ id: "cm1" } as never);
		const res = await recordInvoiceCommission(fakeTx, {
			referredUserId: "u1",
			plan: "pro",
			stripeInvoiceId: "in_1",
			netAmountCents: 4900,
		});
		expect(res).toEqual({
			status: "recorded",
			commissionId: "cm1",
			amountCents: 980, // 20 % of 4900
			rateBps: 2000,
		});
		expect(referralQueries.createCommission).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				conversionId: "c1",
				affiliateId: "a1",
				amountCents: 980,
				stripeInvoiceId: "in_1",
				status: "pending",
				type: "recurring",
			}),
		);
	});

	it("returns duplicate when invoice already has a commission row", async () => {
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue({
			id: "c1",
			affiliateId: "a1",
			status: "paid",
		} as never);
		vi.mocked(referralQueries.createCommission).mockResolvedValue(null);
		const res = await recordInvoiceCommission(fakeTx, {
			referredUserId: "u1",
			plan: "pro",
			stripeInvoiceId: "in_1",
			netAmountCents: 4900,
		});
		expect(res).toEqual({ status: "duplicate" });
	});

	it("picks higher tier rate when affiliate already has many conversions", async () => {
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue({
			id: "c1",
			affiliateId: "a1",
			status: "paid",
		} as never);
		// Existing 15 commissions pushes affiliate to tier 1 (25 %)
		vi.mocked(referralQueries.listCommissionsForAffiliate).mockResolvedValue(
			Array.from({ length: 15 }, (_, i) => ({ id: `c${i}` })) as never,
		);
		vi.mocked(referralQueries.createCommission).mockResolvedValue({ id: "cm2" } as never);
		const res = await recordInvoiceCommission(fakeTx, {
			referredUserId: "u1",
			plan: "pro",
			stripeInvoiceId: "in_2",
			netAmountCents: 10000,
		});
		expect(res).toMatchObject({ status: "recorded", amountCents: 2500, rateBps: 2500 });
	});
});
