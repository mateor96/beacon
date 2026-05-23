import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BillingError } from "../../stripe/types.js";

vi.mock("stripe", () => {
	const MockStripe = vi.fn();
	return { default: MockStripe };
});

describe("createStripeClient", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("throws BillingError when no key is provided and env is unset", async () => {
		vi.stubEnv("STRIPE_SECRET_KEY", "");
		const { createStripeClient } = await import("../../stripe/client.js");

		expect(() => createStripeClient()).toThrow("STRIPE_SECRET_KEY ist nicht gesetzt.");

		try {
			createStripeClient();
		} catch (e) {
			expect((e as Error).name).toBe("BillingError");
			expect((e as { code: string }).code).toBe("STRIPE_API_ERROR");
		}
	});

	it("creates Stripe client with explicit key", async () => {
		const { default: Stripe } = await import("stripe");
		const { createStripeClient } = await import("../../stripe/client.js");

		const client = createStripeClient("sk_test_explicit");

		expect(Stripe).toHaveBeenCalledWith("sk_test_explicit");
		expect(client).toBeDefined();
	});

	it("falls back to STRIPE_SECRET_KEY env variable", async () => {
		vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_from_env");
		const { default: Stripe } = await import("stripe");
		const { createStripeClient } = await import("../../stripe/client.js");

		const client = createStripeClient();

		expect(Stripe).toHaveBeenCalledWith("sk_test_from_env");
		expect(client).toBeDefined();
	});
});
