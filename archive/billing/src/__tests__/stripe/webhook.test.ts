import { describe, expect, it, type vi } from "vitest";
import { constructWebhookEvent, handleWebhookEvent } from "../../stripe/webhook.js";
import {
	MOCK_PRICE_MAP,
	createCheckoutCompletedEvent,
	createMockStripe,
	createSubscriptionCancelScheduledEvent,
	createSubscriptionDeletedEvent,
	createSubscriptionUpdatedEvent,
	createSubscriptionUpdatedEventWithMetadata,
	createSubscriptionUpdatedEventWithoutPeriodStart,
} from "./_fixtures.js";

describe("constructWebhookEvent", () => {
	it("delegates to stripe.webhooks.constructEvent", () => {
		const stripe = createMockStripe();
		const constructFn = (
			stripe as unknown as { webhooks: { constructEvent: ReturnType<typeof vi.fn> } }
		).webhooks.constructEvent;
		constructFn.mockReturnValue({ id: "evt_test", type: "test" });

		const result = constructWebhookEvent(stripe, "payload", "sig_header", "whsec_test");

		expect(constructFn).toHaveBeenCalledWith("payload", "sig_header", "whsec_test");
		expect(result).toEqual({ id: "evt_test", type: "test" });
	});

	it("throws when stripe throws (invalid signature)", () => {
		const stripe = createMockStripe();
		const constructFn = (
			stripe as unknown as { webhooks: { constructEvent: ReturnType<typeof vi.fn> } }
		).webhooks.constructEvent;
		constructFn.mockImplementation(() => {
			throw new Error("No signatures found matching the expected signature");
		});

		expect(() => constructWebhookEvent(stripe, "bad", "bad_sig", "whsec_test")).toThrow(
			"No signatures found matching",
		);
	});
});

describe("handleWebhookEvent", () => {
	describe("checkout.session.completed", () => {
		it("returns subscription_created with correct data", () => {
			const event = createCheckoutCompletedEvent("pro", "monthly");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.action).toBe("subscription_created");
			expect(result.stripeCustomerId).toBe("cus_test_123");
			expect(result.stripeSubscriptionId).toBe("sub_test_123");
			expect(result.planName).toBe("pro");
			expect(result.interval).toBe("monthly");
			expect(result.stripeEventId).toBe("evt_checkout_123");
		});

		it("returns clientReferenceId from client_reference_id", () => {
			const event = createCheckoutCompletedEvent("pro", "monthly");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.clientReferenceId).toBe("user-123");
		});

		it("falls back to metadata.userId when client_reference_id is missing", () => {
			const event = createCheckoutCompletedEvent("pro", "monthly");
			(event.data.object as Record<string, unknown>).client_reference_id = null;
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.clientReferenceId).toBe("user-123");
		});

		it("returns null stripeCustomerId when customer is an object", () => {
			const event = {
				id: "evt_co_obj",
				type: "checkout.session.completed" as const,
				data: {
					object: {
						id: "cs_test",
						customer: { id: "cus_123" },
						subscription: "sub_test",
						client_reference_id: null,
						metadata: { plan: "pro", interval: "monthly" },
					},
				},
			};
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.stripeCustomerId).toBeNull();
			expect(result.stripeSubscriptionId).toBe("sub_test");
		});
	});

	describe("customer.subscription.updated", () => {
		it("returns subscription_updated with plan from price lookup", () => {
			const event = createSubscriptionUpdatedEvent("price_pro_m", "active");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.action).toBe("subscription_updated");
			expect(result.planName).toBe("pro");
			expect(result.interval).toBe("monthly");
		});

		it("returns payment_failed for past_due status", () => {
			const event = createSubscriptionUpdatedEvent("price_pro_m", "past_due");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.action).toBe("payment_failed");
			expect(result.planName).toBeNull();
		});

		it("returns payment_failed for unpaid status", () => {
			const event = createSubscriptionUpdatedEvent("price_pro_m", "unpaid");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.action).toBe("payment_failed");
		});

		it("resolves plan from different price IDs", () => {
			const event = createSubscriptionUpdatedEvent("price_agency_y", "active");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.planName).toBe("agency");
			expect(result.interval).toBe("yearly");
		});

		it("returns null planName for unknown price ID", () => {
			const event = createSubscriptionUpdatedEvent("price_unknown", "active");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.action).toBe("subscription_updated");
			expect(result.planName).toBeNull();
		});

		it("falls back to metadata when price ID not in map", () => {
			const event = createSubscriptionUpdatedEventWithMetadata("agency", "yearly");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.action).toBe("subscription_updated");
			expect(result.planName).toBe("agency");
			expect(result.interval).toBe("yearly");
		});

		it("populates subscriptionStatus and cancelAtPeriodEnd", () => {
			const event = createSubscriptionUpdatedEvent("price_pro_m", "active");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.subscriptionStatus).toBe("active");
			expect(result.cancelAtPeriodEnd).toBe(false);
			expect(result.periodEnd).toBeTruthy();
		});

		it("returns subscription_updated with cancelAtPeriodEnd when scheduled", () => {
			const event = createSubscriptionCancelScheduledEvent("price_pro_m");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.action).toBe("subscription_updated");
			expect(result.cancelAtPeriodEnd).toBe(true);
			expect(result.periodEnd).toBeTruthy();
			expect(result.subscriptionStatus).toBe("active");
		});

		it("returns clientReferenceId as null", () => {
			const event = createSubscriptionUpdatedEvent("price_pro_m", "active");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.clientReferenceId).toBeNull();
		});

		it("returns null stripeCustomerId when customer is an object", () => {
			const event = {
				id: "evt_sub_obj",
				type: "customer.subscription.updated" as const,
				data: {
					object: {
						id: "sub_123",
						customer: { id: "cus_123" },
						status: "active",
						cancel_at_period_end: false,
						current_period_end: 1735689600,
						items: { data: [{ price: { id: "price_pro_m" } }] },
						metadata: {},
					},
				},
			};
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.stripeCustomerId).toBeNull();
		});

		it("extracts periodStart from subscription_updated", () => {
			const event = createSubscriptionUpdatedEvent("price_pro_m", "active");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.periodStart).toBe("2024-12-02T00:00:00.000Z");
		});

		it("extracts periodStart from subscription with metadata fallback", () => {
			const event = createSubscriptionUpdatedEventWithMetadata("agency", "yearly");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.periodStart).toBe("2024-12-02T00:00:00.000Z");
		});

		it("returns null periodStart when current_period_start is missing", () => {
			const event = createSubscriptionUpdatedEventWithoutPeriodStart("price_pro_m");
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.periodStart).toBeNull();
		});
	});

	describe("customer.subscription.deleted", () => {
		it("returns subscription_deleted", () => {
			const event = createSubscriptionDeletedEvent();
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.action).toBe("subscription_deleted");
			expect(result.stripeCustomerId).toBe("cus_test_123");
			expect(result.stripeSubscriptionId).toBe("sub_test_123");
		});

		it("returns subscriptionStatus as canceled", () => {
			const event = createSubscriptionDeletedEvent();
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.subscriptionStatus).toBe("canceled");
		});

		it("returns null stripeCustomerId when customer is an object", () => {
			const event = {
				id: "evt_del_obj",
				type: "customer.subscription.deleted" as const,
				data: {
					object: {
						id: "sub_456",
						customer: { id: "cus_456" },
						status: "canceled",
						items: { data: [] },
						metadata: {},
					},
				},
			};
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);
			expect(result.stripeCustomerId).toBeNull();
		});
	});

	describe("unknown events", () => {
		it("returns ignored for unknown event types", () => {
			const event = { id: "evt_unknown", type: "invoice.finalized", data: { object: {} } };
			const result = handleWebhookEvent(event as never, MOCK_PRICE_MAP);

			expect(result.action).toBe("ignored");
			expect(result.rawEventType).toBe("invoice.finalized");
		});
	});
});
