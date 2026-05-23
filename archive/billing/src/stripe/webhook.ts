import type { PlanName } from "@beacon/shared";
import type Stripe from "stripe";
import type { PlanFeatures } from "../types.js";
import { parseFeatureOverrides } from "./metadata.js";
import { lookupPlanByPriceId } from "./prices.js";
import type { BillingInterval, StripePriceMap, WebhookResult } from "./types.js";

export function constructWebhookEvent(
	stripe: Stripe,
	payload: string | Buffer,
	signature: string,
	webhookSecret: string,
): Stripe.Event {
	return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

function resolvePlanFromSubscription(
	subscription: Stripe.Subscription,
	priceMap: StripePriceMap,
): { plan: PlanName; interval: BillingInterval } | null {
	const priceId = subscription.items.data[0]?.price.id;
	if (priceId) {
		const resolved = lookupPlanByPriceId(priceMap, priceId);
		if (resolved) return resolved;
	}

	const metaPlan = subscription.metadata?.plan as PlanName | undefined;
	const metaInterval = subscription.metadata?.interval as BillingInterval | undefined;
	if (metaPlan && metaInterval) {
		return { plan: metaPlan, interval: metaInterval };
	}

	return null;
}

export function handleWebhookEvent(event: Stripe.Event, priceMap: StripePriceMap): WebhookResult {
	const base = {
		stripeEventId: event.id,
		rawEventType: event.type,
		clientReferenceId: null as string | null,
		cancelAtPeriodEnd: null as boolean | null,
		periodEnd: null as string | null,
		periodStart: null as string | null,
		subscriptionStatus: null as string | null,
		featureOverrides: null as Partial<PlanFeatures> | null,
		sessionMetadata: null as Record<string, string> | null,
	};

	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as Stripe.Checkout.Session;
			return {
				...base,
				action: "subscription_created",
				clientReferenceId: session.client_reference_id ?? session.metadata?.userId ?? null,
				stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
				stripeSubscriptionId:
					typeof session.subscription === "string" ? session.subscription : null,
				planName: (session.metadata?.plan as PlanName) ?? null,
				interval: (session.metadata?.interval as BillingInterval) ?? null,
				sessionMetadata: (session.metadata ?? null) as Record<string, string> | null,
			};
		}

		case "customer.subscription.updated": {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
			const subStatus = subscription.status;
			const cancelAt = subscription.cancel_at_period_end ?? false;
			// current_period_end/start are present in webhook payloads but removed from SDK types in v20+
			const rawSub = subscription as unknown as Record<string, unknown>;
			const rawPeriodEnd = rawSub.current_period_end;
			const periodEndTs =
				typeof rawPeriodEnd === "number" ? new Date(rawPeriodEnd * 1000).toISOString() : null;
			const rawPeriodStart = rawSub.current_period_start;
			const periodStartTs =
				typeof rawPeriodStart === "number" ? new Date(rawPeriodStart * 1000).toISOString() : null;

			if (subStatus === "past_due" || subStatus === "unpaid") {
				return {
					...base,
					action: "payment_failed",
					stripeCustomerId: customerId,
					stripeSubscriptionId: subscription.id,
					planName: null,
					interval: null,
					subscriptionStatus: subStatus,
					cancelAtPeriodEnd: cancelAt,
					periodEnd: periodEndTs,
					periodStart: periodStartTs,
				};
			}

			const resolved = resolvePlanFromSubscription(subscription, priceMap);
			const featureOverrides = parseFeatureOverrides(subscription.metadata);
			return {
				...base,
				action: "subscription_updated",
				stripeCustomerId: customerId,
				stripeSubscriptionId: subscription.id,
				planName: resolved?.plan ?? null,
				interval: resolved?.interval ?? null,
				subscriptionStatus: subStatus,
				cancelAtPeriodEnd: cancelAt,
				periodEnd: periodEndTs,
				periodStart: periodStartTs,
				featureOverrides,
			};
		}

		case "invoice.paid": {
			const invoice = event.data.object as Stripe.Invoice;
			const rawInv = invoice as unknown as Record<string, unknown>;
			const rawSub = rawInv.subscription;
			const subscriptionId = typeof rawSub === "string" ? rawSub : null;
			const periodEndRaw = rawInv.period_end;
			const periodStartRaw = rawInv.period_start;
			return {
				...base,
				action: "invoice_paid",
				stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
				stripeSubscriptionId: subscriptionId,
				planName: null,
				interval: null,
				invoiceId: invoice.id ?? null,
				invoiceAmountCents: invoice.amount_paid ?? 0,
				periodEnd:
					typeof periodEndRaw === "number" ? new Date(periodEndRaw * 1000).toISOString() : null,
				periodStart:
					typeof periodStartRaw === "number" ? new Date(periodStartRaw * 1000).toISOString() : null,
			};
		}

		case "charge.refunded": {
			const charge = event.data.object as Stripe.Charge;
			// `invoice` is on the API but not on Stripe SDK v20 types
			const rawCharge = charge as unknown as { invoice?: string | null };
			const invoiceId = typeof rawCharge.invoice === "string" ? rawCharge.invoice : null;
			return {
				...base,
				action: "commission_clawback",
				stripeCustomerId: typeof charge.customer === "string" ? charge.customer : null,
				stripeSubscriptionId: null,
				planName: null,
				interval: null,
				clawbackInvoiceId: invoiceId,
				clawbackReason: "refund",
			};
		}

		case "charge.dispute.created": {
			const dispute = event.data.object as Stripe.Dispute;
			const chargeId = typeof dispute.charge === "string" ? dispute.charge : null;
			return {
				...base,
				action: "commission_clawback",
				stripeCustomerId: null,
				stripeSubscriptionId: null,
				planName: null,
				interval: null,
				/* Invoice is resolved in the route via stripe.charges.retrieve (#475). */
				clawbackChargeId: chargeId,
				clawbackInvoiceId: null,
				clawbackReason: "chargeback",
			};
		}

		case "customer.subscription.deleted": {
			const subscription = event.data.object as Stripe.Subscription;
			return {
				...base,
				action: "subscription_deleted",
				stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
				stripeSubscriptionId: subscription.id,
				planName: null,
				interval: null,
				subscriptionStatus: "canceled",
			};
		}

		default:
			return {
				...base,
				action: "ignored",
				stripeCustomerId: null,
				stripeSubscriptionId: null,
				planName: null,
				interval: null,
			};
	}
}
