import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	referralQueries: {
		listPayoutsForAffiliate: vi.fn().mockResolvedValue([]),
		getAffiliateById: vi.fn(),
		createPayout: vi.fn(),
		getPayoutById: vi.fn(),
		updatePayout: vi.fn(),
		listCommissionsForAffiliate: vi.fn().mockResolvedValue([]),
		listCommissionsByPayoutId: vi.fn().mockResolvedValue([]),
		updateCommission: vi.fn(),
	},
}));

const { referralQueries } = await import("@beacon/db");
const { requestPayout, transitionPayout } = await import("../../referral/payouts.js");

const fakeDb = {} as never;

describe("requestPayout (#476)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(referralQueries.listPayoutsForAffiliate).mockResolvedValue([]);
	});

	it("rejects when a pending payout already exists", async () => {
		vi.mocked(referralQueries.listPayoutsForAffiliate).mockResolvedValue([
			{ id: "p1", status: "requested" } as never,
		]);
		const res = await requestPayout(fakeDb, { affiliateId: "a1" });
		expect(res).toEqual({ status: "pending_exists", payoutId: "p1" });
	});

	it("rejects when no unlinked approved commissions exist", async () => {
		vi.mocked(referralQueries.listCommissionsForAffiliate).mockResolvedValue([]);
		const res = await requestPayout(fakeDb, { affiliateId: "a1" });
		expect(res).toEqual({ status: "no_balance" });
	});

	it("rejects when snapshot amount is below minimum", async () => {
		vi.mocked(referralQueries.listCommissionsForAffiliate).mockResolvedValue([
			{ id: "c1", amountCents: 2000 },
			{ id: "c2", amountCents: 2000 },
		] as never);
		const res = await requestPayout(fakeDb, { affiliateId: "a1" });
		expect(res).toMatchObject({ status: "below_minimum", unpaidBalanceCents: 4000 });
	});

	it("snapshots approved+unlinked commissions and links them to the new payout", async () => {
		vi.mocked(referralQueries.listCommissionsForAffiliate).mockResolvedValue([
			{ id: "c1", amountCents: 6000 },
			{ id: "c2", amountCents: 4000 },
		] as never);
		vi.mocked(referralQueries.getAffiliateById).mockResolvedValue({
			id: "a1",
			payoutDetails: { method: "bank_transfer", iban: "DE..." },
		} as never);
		vi.mocked(referralQueries.createPayout).mockResolvedValue({
			id: "p_new",
			amountCents: 10000,
		} as never);

		const res = await requestPayout(fakeDb, { affiliateId: "a1" });

		expect(res).toEqual({ status: "requested", payoutId: "p_new", amountCents: 10000 });
		// Snapshot passed unlinkedOnly=true
		expect(referralQueries.listCommissionsForAffiliate).toHaveBeenCalledWith(
			fakeDb,
			"a1",
			expect.objectContaining({ status: "approved", unlinkedOnly: true }),
		);
		// Payout created with the snapshot sum
		expect(referralQueries.createPayout).toHaveBeenCalledWith(
			fakeDb,
			expect.objectContaining({ amountCents: 10000, method: "bank_transfer" }),
		);
		// Each snapshotted commission linked to the new payout
		expect(referralQueries.updateCommission).toHaveBeenCalledWith(fakeDb, "c1", {
			payoutId: "p_new",
		});
		expect(referralQueries.updateCommission).toHaveBeenCalledWith(fakeDb, "c2", {
			payoutId: "p_new",
		});
		expect(referralQueries.updateCommission).toHaveBeenCalledTimes(2);
	});
});

describe("transitionPayout (#476)", () => {
	beforeEach(() => vi.clearAllMocks());

	it("rejects illegal transitions", async () => {
		vi.mocked(referralQueries.getPayoutById).mockResolvedValue({
			id: "p1",
			status: "completed",
		} as never);
		const res = await transitionPayout(fakeDb, "p1", "failed");
		expect(res).toMatchObject({ status: "invalid_transition" });
	});

	it("allows requested → approved", async () => {
		vi.mocked(referralQueries.getPayoutById).mockResolvedValue({
			id: "p1",
			status: "requested",
			affiliateId: "a1",
			stripePayoutId: null,
			processedAt: null,
		} as never);
		const res = await transitionPayout(fakeDb, "p1", "approved");
		expect(res).toEqual({ status: "transitioned", from: "requested", to: "approved" });
	});

	it("flips ONLY commissions linked to the specific payout on processing → completed", async () => {
		vi.mocked(referralQueries.getPayoutById).mockResolvedValue({
			id: "p1",
			status: "processing",
			affiliateId: "a1",
			stripePayoutId: "po_1",
			processedAt: null,
		} as never);
		// Scoped-by-payoutId query returns only THIS payout's commissions
		vi.mocked(referralQueries.listCommissionsByPayoutId).mockResolvedValue([
			{ id: "c1" },
			{ id: "c2" },
		] as never);

		const res = await transitionPayout(fakeDb, "p1", "completed");
		expect(res).toMatchObject({ status: "transitioned", to: "completed" });
		// Must use listCommissionsByPayoutId (scoped), not listCommissionsForAffiliate
		expect(referralQueries.listCommissionsByPayoutId).toHaveBeenCalledWith(fakeDb, "p1");
		expect(referralQueries.listCommissionsForAffiliate).not.toHaveBeenCalled();
		expect(referralQueries.updateCommission).toHaveBeenCalledTimes(2);
		expect(referralQueries.updateCommission).toHaveBeenCalledWith(fakeDb, "c1", {
			status: "paid",
		});
	});

	it("releases payoutId link on transition to failed", async () => {
		vi.mocked(referralQueries.getPayoutById).mockResolvedValue({
			id: "p1",
			status: "processing",
			affiliateId: "a1",
			stripePayoutId: null,
			processedAt: null,
		} as never);
		vi.mocked(referralQueries.listCommissionsByPayoutId).mockResolvedValue([
			{ id: "c1" },
			{ id: "c2" },
		] as never);

		await transitionPayout(fakeDb, "p1", "failed");

		expect(referralQueries.updateCommission).toHaveBeenCalledWith(fakeDb, "c1", {
			payoutId: null,
		});
		expect(referralQueries.updateCommission).toHaveBeenCalledWith(fakeDb, "c2", {
			payoutId: null,
		});
	});

	it("does not touch commissions on requested → approved (only completion flips)", async () => {
		vi.mocked(referralQueries.getPayoutById).mockResolvedValue({
			id: "p1",
			status: "requested",
			affiliateId: "a1",
			stripePayoutId: null,
			processedAt: null,
		} as never);
		await transitionPayout(fakeDb, "p1", "approved");
		expect(referralQueries.updateCommission).not.toHaveBeenCalled();
		expect(referralQueries.listCommissionsByPayoutId).not.toHaveBeenCalled();
	});
});
