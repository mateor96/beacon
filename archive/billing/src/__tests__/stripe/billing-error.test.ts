import { describe, expect, it } from "vitest";
import { BillingError } from "../../stripe/types.js";

describe("BillingError", () => {
	it("sets name to BillingError", () => {
		const error = new BillingError("STRIPE_API_ERROR", "test message");
		expect(error.name).toBe("BillingError");
	});

	it("sets code and message correctly", () => {
		const error = new BillingError("INVALID_PLAN", "Plan nicht gefunden");
		expect(error.code).toBe("INVALID_PLAN");
		expect(error.message).toBe("Plan nicht gefunden");
	});

	it("is an instance of Error", () => {
		const error = new BillingError("STRIPE_API_ERROR", "test");
		expect(error).toBeInstanceOf(Error);
	});

	it("is an instance of BillingError", () => {
		const error = new BillingError("STRIPE_API_ERROR", "test");
		expect(error).toBeInstanceOf(BillingError);
	});

	it.each([
		"INVALID_PLAN",
		"CHECKOUT_REJECTED",
		"PRICE_NOT_CONFIGURED",
		"MISSING_CUSTOMER",
		"WEBHOOK_SIGNATURE_INVALID",
		"STRIPE_API_ERROR",
	] as const)("supports error code: %s", (code) => {
		const error = new BillingError(code, `Error with code ${code}`);
		expect(error.code).toBe(code);
		expect(error.name).toBe("BillingError");
	});
});
