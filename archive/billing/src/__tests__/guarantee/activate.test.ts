import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	guaranteeQueries: {
		createClaimIdempotent: vi.fn(),
		updateClaim: vi.fn(),
	},
	scanQueries: {
		create: vi.fn(),
	},
	monitoringProjects: {},
	scans: {},
}));

vi.mock("../../guarantee/url-resolver.js", () => ({
	resolveBaselineUrl: vi.fn(),
}));

vi.mock("../../guarantee/eligibility.js", () => ({
	// Keep re-export surface intact, stub checkGuaranteeEligibility so the
	// activate tests don't have to wire up every rule's DB mocks.
	isGuaranteeEligible: vi.fn(),
	checkGuaranteeEligibility: vi.fn(),
}));

const { activateGuaranteeBaseline } = await import("../../guarantee/activate.js");
const { guaranteeQueries, scanQueries } = await import("@beacon/db");
const { resolveBaselineUrl } = await import("../../guarantee/url-resolver.js");
const { checkGuaranteeEligibility } = await import("../../guarantee/eligibility.js");

const fakeTx = {} as never;

describe("activateGuaranteeBaseline", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("defers with terms_not_accepted when termsVersion is missing", async () => {
		vi.mocked(checkGuaranteeEligibility).mockResolvedValue({ eligible: true, failedRule: null });
		const result = await activateGuaranteeBaseline(fakeTx, {
			userId: "u1",
			plan: "pro",
			subscriptionId: "sub_1",
		});
		expect(result).toEqual({ status: "deferred", reason: "terms_not_accepted" });
		expect(guaranteeQueries.createClaimIdempotent).not.toHaveBeenCalled();
	});

	it("returns not_eligible when checkGuaranteeEligibility rejects", async () => {
		vi.mocked(checkGuaranteeEligibility).mockResolvedValue({
			eligible: false,
			reason: "plan not eligible",
			failedRule: "plan_eligible",
		});
		const result = await activateGuaranteeBaseline(fakeTx, {
			userId: "u1",
			plan: "free",
			subscriptionId: "sub_1",
		});
		expect(result).toEqual({
			status: "not_eligible",
			reason: "plan not eligible",
			failedRule: "plan_eligible",
		});
		expect(guaranteeQueries.createClaimIdempotent).not.toHaveBeenCalled();
		expect(scanQueries.create).not.toHaveBeenCalled();
	});

	it("defers when no URL resolves — no claim, no scan", async () => {
		vi.mocked(checkGuaranteeEligibility).mockResolvedValue({ eligible: true, failedRule: null });
		vi.mocked(resolveBaselineUrl).mockResolvedValue(null);
		const result = await activateGuaranteeBaseline(fakeTx, {
			userId: "u1",
			plan: "pro",
			subscriptionId: "sub_1",
			termsVersion: "v1",
		});
		expect(result).toEqual({ status: "deferred", reason: "no_url" });
		expect(guaranteeQueries.createClaimIdempotent).not.toHaveBeenCalled();
		expect(scanQueries.create).not.toHaveBeenCalled();
	});

	it("returns duplicate when subscription already has a claim — no scan allocated", async () => {
		vi.mocked(checkGuaranteeEligibility).mockResolvedValue({ eligible: true, failedRule: null });
		vi.mocked(resolveBaselineUrl).mockResolvedValue("https://example.com");
		vi.mocked(guaranteeQueries.createClaimIdempotent).mockResolvedValue(null);

		const result = await activateGuaranteeBaseline(fakeTx, {
			userId: "u1",
			plan: "pro",
			subscriptionId: "sub_1",
			termsVersion: "v1",
		});
		expect(result).toEqual({ status: "duplicate" });
		expect(scanQueries.create).not.toHaveBeenCalled();
		expect(guaranteeQueries.updateClaim).not.toHaveBeenCalled();
	});

	it("creates claim, scan, and attaches baseline on the happy path", async () => {
		vi.mocked(checkGuaranteeEligibility).mockResolvedValue({ eligible: true, failedRule: null });
		vi.mocked(resolveBaselineUrl).mockResolvedValue("https://site.example");
		vi.mocked(guaranteeQueries.createClaimIdempotent).mockResolvedValue({
			id: "claim_1",
		} as never);
		vi.mocked(scanQueries.create).mockResolvedValue({ id: "scan_1" } as never);
		vi.mocked(guaranteeQueries.updateClaim).mockResolvedValue({ id: "claim_1" } as never);

		const result = await activateGuaranteeBaseline(fakeTx, {
			userId: "u1",
			plan: "pro",
			subscriptionId: "sub_xyz",
			startedAt: new Date("2026-04-19T00:00:00Z"),
			termsVersion: "2026-04-19-v1",
		});

		expect(result).toEqual({
			status: "activated",
			claimId: "claim_1",
			scanId: "scan_1",
			url: "https://site.example",
		});

		expect(guaranteeQueries.createClaimIdempotent).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				userId: "u1",
				subscriptionId: "sub_xyz",
				status: "active",
				startedAt: expect.any(Date),
				termsVersion: "2026-04-19-v1",
				termsAcceptedAt: expect.any(Date),
			}),
		);
		const scanArgs = vi.mocked(scanQueries.create).mock.calls[0][1];
		expect(scanArgs.url).toBe("https://site.example");
		expect(scanArgs.status).toBe("pending");
		// Retention must outlive the 90-day guarantee window (default scan
		// retention of 30 days would null out the FK too early).
		expect(scanArgs.expiresAt).toBeInstanceOf(Date);
		const daysUntilExpiry = Math.round(
			((scanArgs.expiresAt as Date).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
		);
		expect(daysUntilExpiry).toBeGreaterThan(90);

		expect(guaranteeQueries.updateClaim).toHaveBeenCalledWith(fakeTx, "claim_1", {
			baselineSnapshotId: "scan_1",
		});
	});
});
