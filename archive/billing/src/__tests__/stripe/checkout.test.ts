import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "../../stripe/checkout.js";
import { BillingError } from "../../stripe/types.js";
import { MOCK_PRICE_MAP, createMockStripe } from "./_fixtures.js";

describe("createCheckoutSession", () => {
	beforeEach(() => vi.clearAllMocks());

	it("creates session with correct price ID", async () => {
		const stripe = createMockStripe();
		const result = await createCheckoutSession(stripe, MOCK_PRICE_MAP, {
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			interval: "monthly",
			successUrl: "https://app.com/success",
			cancelUrl: "https://app.com/cancel",
		});

		expect(result.sessionId).toBe("cs_test_123");
		expect(result.url).toBe("https://checkout.stripe.com/test");

		const call = (
			stripe as unknown as { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).checkout.sessions.create;
		const params = call.mock.calls[0][0];
		expect(params.mode).toBe("subscription");
		expect(params.line_items[0].price).toBe("price_pro_m");
		expect(params.client_reference_id).toBe("user-1");
	});

	it("uses existing customer ID when provided", async () => {
		const stripe = createMockStripe();
		await createCheckoutSession(stripe, MOCK_PRICE_MAP, {
			userId: "user-1",
			email: "test@example.com",
			plan: "starter",
			interval: "yearly",
			existingCustomerId: "cus_existing",
			successUrl: "https://app.com/success",
			cancelUrl: "https://app.com/cancel",
		});

		const call = (
			stripe as unknown as { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).checkout.sessions.create;
		const params = call.mock.calls[0][0];
		expect(params.customer).toBe("cus_existing");
		expect(params.customer_email).toBeUndefined();
	});

	it("sets metadata on session and subscription_data", async () => {
		const stripe = createMockStripe();
		await createCheckoutSession(stripe, MOCK_PRICE_MAP, {
			userId: "user-1",
			email: "test@example.com",
			plan: "agency",
			interval: "yearly",
			successUrl: "https://app.com/success",
			cancelUrl: "https://app.com/cancel",
		});

		const call = (
			stripe as unknown as { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).checkout.sessions.create;
		const params = call.mock.calls[0][0];
		expect(params.metadata).toEqual({ userId: "user-1", plan: "agency", interval: "yearly" });
		expect(params.subscription_data.metadata).toEqual({
			userId: "user-1",
			plan: "agency",
			interval: "yearly",
		});
	});

	it("throws when Stripe does not return a checkout URL", async () => {
		const stripe = createMockStripe();
		const createSession = (
			stripe as unknown as { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).checkout.sessions.create;
		createSession.mockResolvedValueOnce({ id: "cs_test_123", url: null });

		const result = createCheckoutSession(stripe, MOCK_PRICE_MAP, {
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			interval: "monthly",
			successUrl: "https://app.com/success",
			cancelUrl: "https://app.com/cancel",
		});

		await expect(result).rejects.toBeInstanceOf(BillingError);
		await expect(result).rejects.toMatchObject({ code: "STRIPE_API_ERROR" });
	});

	it("throws for free plan", async () => {
		const stripe = createMockStripe();
		await expect(
			createCheckoutSession(stripe, MOCK_PRICE_MAP, {
				userId: "user-1",
				email: "test@example.com",
				plan: "free",
				interval: "monthly",
				successUrl: "https://app.com/success",
				cancelUrl: "https://app.com/cancel",
			}),
		).rejects.toThrow(BillingError);
	});

	it("throws for enterprise plan", async () => {
		const stripe = createMockStripe();
		await expect(
			createCheckoutSession(stripe, MOCK_PRICE_MAP, {
				userId: "user-1",
				email: "test@example.com",
				plan: "enterprise",
				interval: "monthly",
				successUrl: "https://app.com/success",
				cancelUrl: "https://app.com/cancel",
			}),
		).rejects.toThrow(BillingError);
	});

	it("throws BillingError with code CHECKOUT_REJECTED for free plan", async () => {
		const stripe = createMockStripe();
		try {
			await createCheckoutSession(stripe, MOCK_PRICE_MAP, {
				userId: "user-1",
				email: "test@example.com",
				plan: "free",
				interval: "monthly",
				successUrl: "https://app.com/success",
				cancelUrl: "https://app.com/cancel",
			});
			expect.unreachable("should have thrown");
		} catch (e) {
			expect((e as BillingError).code).toBe("CHECKOUT_REJECTED");
		}
	});

	it("sets customer_email when no existingCustomerId", async () => {
		const stripe = createMockStripe();
		await createCheckoutSession(stripe, MOCK_PRICE_MAP, {
			userId: "user-1",
			email: "hello@example.com",
			plan: "pro",
			interval: "monthly",
			successUrl: "https://app.com/success",
			cancelUrl: "https://app.com/cancel",
		});
		const call = (
			stripe as unknown as { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).checkout.sessions.create;
		const params = call.mock.calls[0][0];
		expect(params.customer_email).toBe("hello@example.com");
		expect(params.customer).toBeUndefined();
	});

	it("passes success_url, cancel_url, and allow_promotion_codes", async () => {
		const stripe = createMockStripe();
		await createCheckoutSession(stripe, MOCK_PRICE_MAP, {
			userId: "user-1",
			email: "test@example.com",
			plan: "starter",
			interval: "monthly",
			successUrl: "https://app.com/success",
			cancelUrl: "https://app.com/cancel",
		});
		const call = (
			stripe as unknown as { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).checkout.sessions.create;
		const params = call.mock.calls[0][0];
		expect(params.success_url).toBe("https://app.com/success");
		expect(params.cancel_url).toBe("https://app.com/cancel");
		expect(params.allow_promotion_codes).toBe(true);
	});

	it("propagates Stripe API errors", async () => {
		const stripe = createMockStripe();
		const createFn = (
			stripe as unknown as { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } }
		).checkout.sessions.create;
		createFn.mockRejectedValue(new Error("Stripe API unavailable"));
		await expect(
			createCheckoutSession(stripe, MOCK_PRICE_MAP, {
				userId: "user-1",
				email: "test@example.com",
				plan: "pro",
				interval: "monthly",
				successUrl: "https://app.com/success",
				cancelUrl: "https://app.com/cancel",
			}),
		).rejects.toThrow("Stripe API unavailable");
	});
});
