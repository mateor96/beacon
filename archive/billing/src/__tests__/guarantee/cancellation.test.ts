import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaimBySubscriptionId = vi.fn();
const getClaimById = vi.fn();
const updateClaim = vi.fn();

vi.mock("@beacon/db", () => ({
	guaranteeQueries: {
		getClaimBySubscriptionId: (...a: unknown[]) => getClaimBySubscriptionId(...a),
		getClaimById: (...a: unknown[]) => getClaimById(...a),
		updateClaim: (...a: unknown[]) => updateClaim(...a),
	},
	auditQueries: {},
}));

import {
	TERMINAL_STATUSES,
	adminOverrideStatus,
	cancelGuaranteeForSubscription,
	isTerminalStatus,
	refundEligibilityGuard,
} from "../../guarantee/cancellation.js";

beforeEach(() => {
	getClaimBySubscriptionId.mockReset();
	getClaimById.mockReset();
	updateClaim.mockReset();
});

const baseClaim = {
	id: "claim-1",
	userId: "user-1",
	subscriptionId: "sub_123",
	status: "active" as const,
	resolutionNotes: null,
	startedAt: new Date("2026-01-01T00:00:00Z"),
	baselineSnapshotId: null,
	stripeRefundId: null,
	termsVersion: null,
	termsAcceptedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("isTerminalStatus (#285)", () => {
	it("returns true for every declared terminal status", () => {
		for (const s of TERMINAL_STATUSES) {
			expect(isTerminalStatus(s)).toBe(true);
		}
	});
	it("returns false for active/improved/eligible_for_refund", () => {
		expect(isTerminalStatus("active")).toBe(false);
		expect(isTerminalStatus("improved")).toBe(false);
		expect(isTerminalStatus("eligible_for_refund")).toBe(false);
	});
});

describe("cancelGuaranteeForSubscription (#285)", () => {
	it("cancels an active claim and appends the reason", async () => {
		getClaimBySubscriptionId.mockResolvedValue(baseClaim);
		updateClaim.mockResolvedValue({ ...baseClaim, status: "cancelled" });
		const result = await cancelGuaranteeForSubscription(
			{} as never,
			"sub_123",
			"subscription_deleted",
		);
		expect(result.cancelled).toBe(true);
		expect(result.claimId).toBe("claim-1");
		expect(updateClaim).toHaveBeenCalledWith(
			expect.anything(),
			"claim-1",
			expect.objectContaining({
				status: "cancelled",
				resolutionNotes: expect.stringContaining("subscription_deleted") as unknown as string,
			}),
		);
	});

	it("no-ops when the claim is already terminal", async () => {
		getClaimBySubscriptionId.mockResolvedValue({ ...baseClaim, status: "refunded" });
		const result = await cancelGuaranteeForSubscription({} as never, "sub_123", "test");
		expect(result.cancelled).toBe(false);
		expect(result.skipped).toBe("already_terminal");
		expect(updateClaim).not.toHaveBeenCalled();
	});

	it("no-ops idempotently when already cancelled", async () => {
		getClaimBySubscriptionId.mockResolvedValue({ ...baseClaim, status: "cancelled" });
		const result = await cancelGuaranteeForSubscription({} as never, "sub_123", "test");
		expect(result.cancelled).toBe(false);
		expect(updateClaim).not.toHaveBeenCalled();
	});

	it("returns not_found when no claim exists for the subscription", async () => {
		getClaimBySubscriptionId.mockResolvedValue(undefined);
		const result = await cancelGuaranteeForSubscription({} as never, "sub_unknown", "test");
		expect(result.cancelled).toBe(false);
		expect(result.skipped).toBe("not_found");
	});

	it("preserves prior resolutionNotes when appending the cancellation reason", async () => {
		getClaimBySubscriptionId.mockResolvedValue({
			...baseClaim,
			resolutionNotes: "earlier note",
		});
		updateClaim.mockResolvedValue({});
		await cancelGuaranteeForSubscription({} as never, "sub_123", "plan_downgrade");
		expect(updateClaim).toHaveBeenCalledWith(
			expect.anything(),
			"claim-1",
			expect.objectContaining({
				resolutionNotes: expect.stringContaining("earlier note") as unknown as string,
			}),
		);
	});
});

describe("adminOverrideStatus (#285)", () => {
	it("returns null when the claim is missing", async () => {
		getClaimById.mockResolvedValue(undefined);
		const result = await adminOverrideStatus({} as never, "claim-missing", {
			newStatus: "refunded",
			adminUserId: "admin-1",
			reason: "goodwill",
		});
		expect(result).toBeNull();
	});

	it("updates the claim status and captures previous status", async () => {
		getClaimById.mockResolvedValue(baseClaim);
		updateClaim.mockResolvedValue({ ...baseClaim, status: "refunded" });
		const result = await adminOverrideStatus({} as never, "claim-1", {
			newStatus: "refunded",
			adminUserId: "admin-1",
			reason: "goodwill",
		});
		expect(result?.previousStatus).toBe("active");
		expect(result?.claim.status).toBe("refunded");
		expect(updateClaim).toHaveBeenCalledWith(
			expect.anything(),
			"claim-1",
			expect.objectContaining({ status: "refunded" }),
		);
	});

	it("captures admin userId + reason in the resolutionNotes", async () => {
		getClaimById.mockResolvedValue(baseClaim);
		updateClaim.mockResolvedValue({});
		await adminOverrideStatus({} as never, "claim-1", {
			newStatus: "denied",
			adminUserId: "admin-42",
			reason: "duplicate claim",
		});
		const call = updateClaim.mock.calls[0]?.[2] as { resolutionNotes?: string };
		expect(call.resolutionNotes).toContain("admin-42");
		expect(call.resolutionNotes).toContain("duplicate claim");
	});
});

describe("refundEligibilityGuard (#285)", () => {
	it("blocks refund for cancelled claims", () => {
		const result = refundEligibilityGuard({ ...baseClaim, status: "cancelled" });
		expect(result?.code).toBe("CLAIM_TERMINAL");
	});

	it("blocks refund for denied claims", () => {
		expect(refundEligibilityGuard({ ...baseClaim, status: "denied" })?.code).toBe("CLAIM_TERMINAL");
	});

	it("allows eligible_for_refund through", () => {
		expect(refundEligibilityGuard({ ...baseClaim, status: "eligible_for_refund" })).toBeNull();
	});

	it("allows active claims through", () => {
		expect(refundEligibilityGuard({ ...baseClaim, status: "active" })).toBeNull();
	});
});
