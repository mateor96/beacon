import { beforeEach, describe, expect, it, vi } from "vitest";

const listCommissionsByInvoiceId = vi.fn();
const updateCommission = vi.fn();

vi.mock("@beacon/db", () => ({
	referralQueries: {
		listCommissionsByInvoiceId: (...a: unknown[]) => listCommissionsByInvoiceId(...a),
		updateCommission: (...a: unknown[]) => updateCommission(...a),
	},
}));

import { clawbackCommissionsByInvoice } from "../referral/clawback.js";

beforeEach(() => {
	listCommissionsByInvoiceId.mockReset();
	updateCommission.mockReset();
});

describe("clawbackCommissionsByInvoice (#299)", () => {
	it("returns 0/empty when no commissions match", async () => {
		listCommissionsByInvoiceId.mockResolvedValue([]);
		const result = await clawbackCommissionsByInvoice({} as never, {
			stripeInvoiceId: "in_xxx",
			reason: "refund",
		});
		expect(result).toEqual({
			commissionsClawedBack: 0,
			totalClawbackCents: 0,
			affiliateIds: [],
		});
		expect(updateCommission).not.toHaveBeenCalled();
	});

	it("flips status to clawed_back for matching commissions", async () => {
		listCommissionsByInvoiceId.mockResolvedValue([
			{ id: "c1", affiliateId: "a1", amountCents: 1000, status: "approved" },
			{ id: "c2", affiliateId: "a1", amountCents: 500, status: "pending" },
		]);
		updateCommission.mockResolvedValue({});

		const result = await clawbackCommissionsByInvoice({} as never, {
			stripeInvoiceId: "in_123",
			reason: "refund",
		});

		expect(result.commissionsClawedBack).toBe(2);
		expect(result.totalClawbackCents).toBe(1500);
		expect(result.affiliateIds).toEqual(["a1"]);
		expect(updateCommission).toHaveBeenCalledTimes(2);
		expect(updateCommission).toHaveBeenCalledWith(
			expect.anything(),
			"c1",
			expect.objectContaining({ status: "clawed_back" }),
		);
	});

	it("aggregates affiliateIds when commissions span affiliates", async () => {
		listCommissionsByInvoiceId.mockResolvedValue([
			{ id: "c1", affiliateId: "a1", amountCents: 1000, status: "approved" },
			{ id: "c2", affiliateId: "a2", amountCents: 500, status: "approved" },
		]);
		updateCommission.mockResolvedValue({});

		const result = await clawbackCommissionsByInvoice({} as never, {
			stripeInvoiceId: "in_xx",
			reason: "chargeback",
		});

		expect(result.affiliateIds.sort()).toEqual(["a1", "a2"]);
	});

	it("is idempotent — already-clawed-back commissions are skipped", async () => {
		listCommissionsByInvoiceId.mockResolvedValue([
			{ id: "c1", affiliateId: "a1", amountCents: 1000, status: "clawed_back" },
			{ id: "c2", affiliateId: "a1", amountCents: 500, status: "approved" },
		]);
		updateCommission.mockResolvedValue({});

		const result = await clawbackCommissionsByInvoice({} as never, {
			stripeInvoiceId: "in_xx",
			reason: "refund",
		});

		expect(result.commissionsClawedBack).toBe(1);
		expect(result.totalClawbackCents).toBe(500);
		expect(updateCommission).toHaveBeenCalledTimes(1);
	});

	it("includes the reason and invoice id in the audit note", async () => {
		listCommissionsByInvoiceId.mockResolvedValue([
			{ id: "c1", affiliateId: "a1", amountCents: 100, status: "approved" },
		]);
		updateCommission.mockResolvedValue({});

		await clawbackCommissionsByInvoice({} as never, {
			stripeInvoiceId: "in_abc",
			reason: "chargeback",
		});

		expect(updateCommission).toHaveBeenCalledWith(
			expect.anything(),
			"c1",
			expect.objectContaining({
				notes: expect.stringContaining("chargeback") as unknown as string,
			}),
		);
		expect(updateCommission).toHaveBeenCalledWith(
			expect.anything(),
			"c1",
			expect.objectContaining({
				notes: expect.stringContaining("in_abc") as unknown as string,
			}),
		);
	});
});
