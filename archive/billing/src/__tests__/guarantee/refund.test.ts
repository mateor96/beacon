import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	guaranteeQueries: {
		getClaimById: vi.fn(),
		updateClaim: vi.fn(),
	},
	profileQueries: {
		getById: vi.fn(),
	},
}));

const { guaranteeQueries, profileQueries } = await import("@beacon/db");
const { processGuaranteeRefund } = await import("../../guarantee/refund.js");

const fakeDb = {} as never;

function makeStripe() {
	return {
		invoices: {
			list: vi.fn(),
		},
		refunds: {
			create: vi.fn(),
		},
		subscriptions: {
			cancel: vi.fn().mockResolvedValue({}),
		},
	};
}

describe("processGuaranteeRefund", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns early when claim does not exist", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue(undefined);
		const res = await processGuaranteeRefund(fakeDb, makeStripe() as never, "c1");
		expect(res.refunded).toBe(false);
		expect(res.error).toBe("claim_not_found");
	});

	it("short-circuits when claim already refunded", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "refunded",
			stripeRefundId: "re_1",
		} as never);
		const stripe = makeStripe();
		const res = await processGuaranteeRefund(fakeDb, stripe as never, "c1");
		expect(res.refunded).toBe(true);
		expect(res.refundIds).toEqual(["re_1"]);
		expect(stripe.invoices.list).not.toHaveBeenCalled();
	});

	it("rejects claims in non-refundable states", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "active",
		} as never);
		const res = await processGuaranteeRefund(fakeDb, makeStripe() as never, "c1");
		expect(res.refunded).toBe(false);
		expect(res.error).toContain("active");
	});

	it("refunds every paid invoice in the 90-day window", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "refund_requested",
			userId: "u1",
			subscriptionId: "sub_1",
			startedAt: new Date("2026-01-01T00:00:00Z"),
			stripeRefundId: null,
		} as never);
		vi.mocked(profileQueries.getById).mockResolvedValue({
			id: "u1",
			stripeCustomerId: "cus_1",
		} as never);

		const stripe = makeStripe();
		stripe.invoices.list.mockResolvedValue({
			data: [
				{ id: "in_1", payment_intent: "pi_1" },
				{ id: "in_2", payment_intent: "pi_2" },
				{ id: "in_3", payment_intent: null },
			],
		} as never);
		stripe.refunds.create
			.mockResolvedValueOnce({ id: "re_1", amount: 4900 })
			.mockResolvedValueOnce({ id: "re_2", amount: 4900 });

		const res = await processGuaranteeRefund(fakeDb, stripe as never, "c1");
		expect(res).toEqual({
			refunded: true,
			refundIds: ["re_1", "re_2"],
			totalAmountCents: 9800,
			skippedInvoices: 1,
		});
		expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_1", {
			invoice_now: false,
			prorate: false,
		});
		expect(guaranteeQueries.updateClaim).toHaveBeenCalledWith(
			fakeDb,
			"c1",
			expect.objectContaining({
				status: "refunded",
				stripeRefundId: "re_2",
			}),
		);
	});

	it("returns error when Stripe invoice list fails", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "refund_requested",
			userId: "u1",
			subscriptionId: "sub_1",
			startedAt: new Date(),
		} as never);
		vi.mocked(profileQueries.getById).mockResolvedValue({
			id: "u1",
			stripeCustomerId: "cus_1",
		} as never);
		const stripe = makeStripe();
		stripe.invoices.list.mockRejectedValue(new Error("Stripe timeout"));
		const res = await processGuaranteeRefund(fakeDb, stripe as never, "c1");
		expect(res.refunded).toBe(false);
		expect(res.error).toBe("Stripe timeout");
	});

	it("still marks refunded when subscription cancellation fails", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "refund_requested",
			userId: "u1",
			subscriptionId: "sub_1",
			startedAt: new Date(),
		} as never);
		vi.mocked(profileQueries.getById).mockResolvedValue({
			id: "u1",
			stripeCustomerId: "cus_1",
		} as never);
		const stripe = makeStripe();
		stripe.invoices.list.mockResolvedValue({
			data: [{ id: "in_1", payment_intent: "pi_1" }],
		} as never);
		stripe.refunds.create.mockResolvedValue({ id: "re_1", amount: 4900 });
		stripe.subscriptions.cancel.mockRejectedValue(new Error("already canceled"));
		const res = await processGuaranteeRefund(fakeDb, stripe as never, "c1");
		expect(res.refunded).toBe(true);
		expect(res.refundIds).toEqual(["re_1"]);
	});
});
