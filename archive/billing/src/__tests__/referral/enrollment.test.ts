import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	referralQueries: {
		getAffiliateByUserId: vi.fn(),
		getAffiliateById: vi.fn(),
		createAffiliate: vi.fn(),
		createLink: vi.fn(),
		updateAffiliate: vi.fn(),
		getLinkByCode: vi.fn(),
	},
}));

const { referralQueries } = await import("@beacon/db");
const { enrollAffiliate, approveAffiliate, rejectAffiliate } = await import(
	"../../referral/enrollment.js"
);

const fakeTx = {} as never;

describe("enrollAffiliate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects when termsAccepted is false", async () => {
		const res = await enrollAffiliate(fakeTx, {
			userId: "u1",
			payoutDetails: { method: "manual" },
			termsAccepted: false,
		});
		expect(res).toEqual({ status: "terms_required" });
		expect(referralQueries.createAffiliate).not.toHaveBeenCalled();
	});

	it("returns already_enrolled when affiliate exists", async () => {
		vi.mocked(referralQueries.getAffiliateByUserId).mockResolvedValue({
			id: "a1",
			status: "pending",
		} as never);
		const res = await enrollAffiliate(fakeTx, {
			userId: "u1",
			payoutDetails: { method: "manual" },
			termsAccepted: true,
		});
		expect(res).toEqual({
			status: "already_enrolled",
			affiliateId: "a1",
			currentStatus: "pending",
		});
	});

	it("creates a pending affiliate on happy path", async () => {
		vi.mocked(referralQueries.getAffiliateByUserId).mockResolvedValue(undefined);
		vi.mocked(referralQueries.createAffiliate).mockResolvedValue({ id: "a_new" } as never);
		const res = await enrollAffiliate(fakeTx, {
			userId: "u1",
			companyName: "Acme",
			payoutDetails: { method: "bank_transfer", iban: "DE..." },
			termsAccepted: true,
		});
		expect(res).toEqual({ status: "created", affiliateId: "a_new" });
		expect(referralQueries.createAffiliate).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				userId: "u1",
				companyName: "Acme",
				status: "pending",
				termsAcceptedAt: expect.any(Date),
			}),
		);
	});
});

describe("approveAffiliate / rejectAffiliate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(referralQueries.getLinkByCode).mockResolvedValue(undefined);
	});

	it("approve: invalid state when affiliate not pending", async () => {
		vi.mocked(referralQueries.getAffiliateById).mockResolvedValue({
			id: "a1",
			status: "active",
		} as never);
		const res = await approveAffiliate(fakeTx, "a1");
		expect(res.status).toBe("invalid_state");
	});

	it("approve: creates first link and sets status active", async () => {
		vi.mocked(referralQueries.getAffiliateById).mockResolvedValue({
			id: "a1",
			status: "pending",
		} as never);
		vi.mocked(referralQueries.createLink).mockResolvedValue({ id: "l1", code: "X" } as never);
		const res = await approveAffiliate(fakeTx, "a1");
		expect(res.status).toBe("approved");
		expect(res.firstLinkCode).toBeDefined();
		expect(referralQueries.updateAffiliate).toHaveBeenCalledWith(fakeTx, "a1", {
			status: "active",
			approvedAt: expect.any(Date),
			rejectionReason: null,
		});
	});

	it("reject: stores reason and sets status rejected", async () => {
		vi.mocked(referralQueries.getAffiliateById).mockResolvedValue({
			id: "a1",
			status: "pending",
		} as never);
		const res = await rejectAffiliate(fakeTx, "a1", "duplicate account");
		expect(res.status).toBe("approved");
		expect(referralQueries.updateAffiliate).toHaveBeenCalledWith(fakeTx, "a1", {
			status: "rejected",
			rejectionReason: "duplicate account",
		});
	});
});
