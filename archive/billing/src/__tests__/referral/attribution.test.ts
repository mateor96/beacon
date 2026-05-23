import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	referralQueries: {
		getLinkByCode: vi.fn(),
		getAffiliateById: vi.fn(),
		createConversion: vi.fn(),
		getConversionByReferredUser: vi.fn(),
		updateConversion: vi.fn(),
	},
}));

const { referralQueries } = await import("@beacon/db");
const { attributeSignup, markConversionPaid } = await import("../../referral/attribution.js");

const fakeTx = {} as never;

describe("attributeSignup", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns no_attribution when cookie and utm both missing", async () => {
		const res = await attributeSignup({ tx: fakeTx, newUserId: "u1" });
		expect(res).toEqual({ status: "no_attribution", reason: "no_code" });
	});

	it("returns no_attribution when link inactive", async () => {
		vi.mocked(referralQueries.getLinkByCode).mockResolvedValue({ id: "l1", isActive: 0 } as never);
		const res = await attributeSignup({ tx: fakeTx, newUserId: "u1", cookieCode: "abc" });
		expect(res).toEqual({ status: "no_attribution", reason: "link_inactive" });
	});

	it("blocks self-referral", async () => {
		vi.mocked(referralQueries.getLinkByCode).mockResolvedValue({
			id: "l1",
			isActive: 1,
			affiliateId: "a1",
		} as never);
		vi.mocked(referralQueries.getAffiliateById).mockResolvedValue({
			id: "a1",
			userId: "u1",
			status: "active",
		} as never);
		const res = await attributeSignup({ tx: fakeTx, newUserId: "u1", cookieCode: "abc" });
		expect(res).toEqual({ status: "no_attribution", reason: "self_referral" });
	});

	it("attributes on happy path with cookie", async () => {
		vi.mocked(referralQueries.getLinkByCode).mockResolvedValue({
			id: "l1",
			isActive: 1,
			affiliateId: "a1",
		} as never);
		vi.mocked(referralQueries.getAffiliateById).mockResolvedValue({
			id: "a1",
			userId: "a_user",
			status: "active",
		} as never);
		vi.mocked(referralQueries.createConversion).mockResolvedValue({ id: "c1" } as never);
		const res = await attributeSignup({ tx: fakeTx, newUserId: "u1", cookieCode: "abc" });
		expect(res).toEqual({ status: "attributed", conversionId: "c1", affiliateId: "a1" });
		expect(referralQueries.createConversion).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({ attributionMethod: "cookie" }),
		);
	});

	it("falls back to utm when cookie absent", async () => {
		vi.mocked(referralQueries.getLinkByCode).mockResolvedValue({
			id: "l1",
			isActive: 1,
			affiliateId: "a1",
		} as never);
		vi.mocked(referralQueries.getAffiliateById).mockResolvedValue({
			id: "a1",
			userId: "a_user",
			status: "active",
		} as never);
		vi.mocked(referralQueries.createConversion).mockResolvedValue({ id: "c2" } as never);
		const res = await attributeSignup({ tx: fakeTx, newUserId: "u1", utmCampaign: "abc" });
		expect(res.status).toBe("attributed");
		expect(referralQueries.createConversion).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({ attributionMethod: "utm" }),
		);
	});

	it("returns duplicate when conversion row already exists for user", async () => {
		vi.mocked(referralQueries.getLinkByCode).mockResolvedValue({
			id: "l1",
			isActive: 1,
			affiliateId: "a1",
		} as never);
		vi.mocked(referralQueries.getAffiliateById).mockResolvedValue({
			id: "a1",
			userId: "a_user",
			status: "active",
		} as never);
		vi.mocked(referralQueries.createConversion).mockResolvedValue(null);
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue({
			id: "existing",
		} as never);
		const res = await attributeSignup({ tx: fakeTx, newUserId: "u1", cookieCode: "abc" });
		expect(res).toEqual({ status: "duplicate", conversionId: "existing" });
	});
});

describe("markConversionPaid", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns not updated when no conversion exists", async () => {
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue(undefined);
		const res = await markConversionPaid(fakeTx, "u1", new Date());
		expect(res).toEqual({ updated: false });
	});

	it("is idempotent — already paid short-circuits", async () => {
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue({
			id: "c1",
			status: "paid",
		} as never);
		const res = await markConversionPaid(fakeTx, "u1", new Date());
		expect(res.updated).toBe(false);
		expect(referralQueries.updateConversion).not.toHaveBeenCalled();
	});

	it("transitions signup → paid on first call", async () => {
		const firstPayment = new Date("2026-04-20T00:00:00Z");
		vi.mocked(referralQueries.getConversionByReferredUser).mockResolvedValue({
			id: "c1",
			status: "signup",
			firstPaymentAt: null,
		} as never);
		const res = await markConversionPaid(fakeTx, "u1", firstPayment);
		expect(res).toEqual({ updated: true, conversionId: "c1" });
		expect(referralQueries.updateConversion).toHaveBeenCalledWith(fakeTx, "c1", {
			status: "paid",
			firstPaymentAt: firstPayment,
		});
	});
});
