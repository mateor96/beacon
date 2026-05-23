import { vi } from "vitest";
import type { StripePriceMap } from "../../stripe/types.js";

export function createMockStripe() {
	return {
		checkout: {
			sessions: {
				create: vi.fn().mockResolvedValue({
					id: "cs_test_123",
					url: "https://checkout.stripe.com/test",
				}),
			},
		},
		billingPortal: {
			sessions: {
				create: vi.fn().mockResolvedValue({
					id: "bps_test_123",
					url: "https://billing.stripe.com/test",
				}),
			},
		},
		webhooks: {
			constructEvent: vi.fn(),
		},
	} as never;
}

export const MOCK_PRICE_MAP: StripePriceMap = {
	starter: { monthly: "price_starter_m", yearly: "price_starter_y" },
	pro: { monthly: "price_pro_m", yearly: "price_pro_y" },
	agency: { monthly: "price_agency_m", yearly: "price_agency_y" },
	enterprise: { monthly: "price_enterprise_m" },
};

export function createCheckoutCompletedEvent(plan = "pro", interval = "monthly") {
	return {
		id: "evt_checkout_123",
		type: "checkout.session.completed" as const,
		data: {
			object: {
				id: "cs_test_123",
				customer: "cus_test_123",
				subscription: "sub_test_123",
				client_reference_id: "user-123",
				metadata: { userId: "user-123", plan, interval },
			},
		},
	};
}

export function createSubscriptionUpdatedEvent(priceId = "price_pro_m", status = "active") {
	return {
		id: "evt_sub_updated_123",
		type: "customer.subscription.updated" as const,
		data: {
			object: {
				id: "sub_test_123",
				customer: "cus_test_123",
				status,
				cancel_at_period_end: false,
				current_period_end: 1735689600, // 2025-01-01T00:00:00Z
				current_period_start: 1733097600, // 2024-12-02T00:00:00Z
				items: { data: [{ price: { id: priceId } }] },
				metadata: { userId: "user-123" },
			},
		},
	};
}

export function createSubscriptionCancelScheduledEvent(priceId = "price_pro_m") {
	return {
		id: "evt_sub_cancel_sched_123",
		type: "customer.subscription.updated" as const,
		data: {
			object: {
				id: "sub_test_123",
				customer: "cus_test_123",
				status: "active",
				cancel_at_period_end: true,
				current_period_end: 1738368000, // 2025-02-01T00:00:00Z
				current_period_start: 1735689600, // 2025-01-01T00:00:00Z
				items: { data: [{ price: { id: priceId } }] },
				metadata: { userId: "user-123" },
			},
		},
	};
}

export function createSubscriptionDeletedEvent() {
	return {
		id: "evt_sub_deleted_123",
		type: "customer.subscription.deleted" as const,
		data: {
			object: {
				id: "sub_test_123",
				customer: "cus_test_123",
				status: "canceled",
				cancel_at_period_end: false,
				current_period_end: 1735689600,
				items: { data: [] },
				metadata: {},
			},
		},
	};
}

export function createSubscriptionUpdatedEventWithMetadata(plan: string, interval: string) {
	return {
		id: "evt_sub_meta_123",
		type: "customer.subscription.updated" as const,
		data: {
			object: {
				id: "sub_meta_123",
				customer: "cus_test_123",
				status: "active",
				cancel_at_period_end: false,
				current_period_end: 1735689600,
				current_period_start: 1733097600,
				items: { data: [{ price: { id: "price_not_in_map" } }] },
				metadata: { userId: "user-123", plan, interval },
			},
		},
	};
}

export function createSubscriptionUpdatedEventWithoutPeriodStart(priceId = "price_pro_m") {
	return {
		id: "evt_sub_no_start_123",
		type: "customer.subscription.updated" as const,
		data: {
			object: {
				id: "sub_test_123",
				customer: "cus_test_123",
				status: "active",
				cancel_at_period_end: false,
				current_period_end: 1735689600,
				items: { data: [{ price: { id: priceId } }] },
				metadata: { userId: "user-123" },
			},
		},
	};
}
