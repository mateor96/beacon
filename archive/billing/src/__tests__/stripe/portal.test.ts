import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPortalSession } from "../../stripe/portal.js";
import { BillingError } from "../../stripe/types.js";
import { createMockStripe } from "./_fixtures.js";

describe("createPortalSession", () => {
	beforeEach(() => vi.clearAllMocks());

	it("creates portal session with customer ID", async () => {
		const stripe = createMockStripe();
		const result = await createPortalSession(stripe, {
			customerId: "cus_test_123",
			returnUrl: "https://app.com/settings",
		});

		expect(result.url).toBe("https://billing.stripe.com/test");
	});

	it("passes correct params to Stripe", async () => {
		const stripe = createMockStripe();
		await createPortalSession(stripe, {
			customerId: "cus_abc",
			returnUrl: "https://app.com/billing",
		});

		const call = (
			stripe as unknown as {
				billingPortal: { sessions: { create: ReturnType<typeof vi.fn> } };
			}
		).billingPortal.sessions.create;
		expect(call.mock.calls[0][0]).toEqual({
			customer: "cus_abc",
			return_url: "https://app.com/billing",
		});
	});

	it("throws when customer ID is empty", async () => {
		const stripe = createMockStripe();
		await expect(
			createPortalSession(stripe, { customerId: "", returnUrl: "https://app.com" }),
		).rejects.toThrow(BillingError);
	});

	it("throws BillingError with code MISSING_CUSTOMER for empty customerId", async () => {
		const stripe = createMockStripe();
		try {
			await createPortalSession(stripe, { customerId: "", returnUrl: "https://app.com" });
			expect.unreachable("should have thrown");
		} catch (e) {
			expect((e as BillingError).code).toBe("MISSING_CUSTOMER");
		}
	});

	it("throws STRIPE_API_ERROR when session.url is null", async () => {
		const stripe = createMockStripe();
		const createFn = (
			stripe as unknown as { billingPortal: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).billingPortal.sessions.create;
		createFn.mockResolvedValue({ id: "bps_test_456", url: null });

		try {
			await createPortalSession(stripe, {
				customerId: "cus_valid",
				returnUrl: "https://app.com",
			});
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(BillingError);
			expect((e as BillingError).code).toBe("STRIPE_API_ERROR");
		}
	});

	it("propagates Stripe API errors", async () => {
		const stripe = createMockStripe();
		const createFn = (
			stripe as unknown as { billingPortal: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).billingPortal.sessions.create;
		createFn.mockRejectedValue(new Error("Stripe is down"));
		await expect(
			createPortalSession(stripe, { customerId: "cus_valid", returnUrl: "https://app.com" }),
		).rejects.toThrow("Stripe is down");
	});
});
