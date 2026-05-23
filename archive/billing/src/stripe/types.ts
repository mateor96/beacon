import type { PlanName } from "@beacon/shared";
import type { PlanFeatures } from "../types.js";

export type BillingInterval = "monthly" | "yearly";

export interface StripePriceMap {
	starter: { monthly: string; yearly: string };
	pro: { monthly: string; yearly: string };
	agency: { monthly: string; yearly: string };
	enterprise: { monthly: string };
}

export interface CheckoutParams {
	userId: string;
	email: string;
	plan: PlanName;
	interval: BillingInterval;
	existingCustomerId?: string;
	successUrl: string;
	cancelUrl: string;
	/**
	 * Target website for the 90-day guarantee baseline scan. When present and
	 * the plan is guarantee-eligible, the baseline is enqueued immediately on
	 * checkout.session.completed; otherwise we fall back to the user's
	 * monitoring project or latest scan URL.
	 */
	baselineUrl?: string;
	/**
	 * Version of the guarantee terms the user accepted at checkout. When set,
	 * the webhook records `{terms_version, terms_accepted_at}` on the claim so
	 * the MVP has legal traceability (#278). Absent = no acceptance captured
	 * and the activation falls through to the deferred / ineligible path.
	 */
	guaranteeTermsVersion?: string;
}

export interface CheckoutResult {
	sessionId: string;
	url: string;
}

export interface PortalParams {
	customerId: string;
	returnUrl: string;
}

export interface PortalResult {
	url: string;
}

export type WebhookAction =
	| "subscription_created"
	| "subscription_updated"
	| "subscription_deleted"
	| "payment_failed"
	| "invoice_paid"
	| "commission_clawback"
	| "ignored";

export interface WebhookResult {
	action: WebhookAction;
	clientReferenceId: string | null;
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	stripeEventId: string;
	planName: PlanName | null;
	interval: BillingInterval | null;
	rawEventType: string;
	cancelAtPeriodEnd: boolean | null;
	periodEnd: string | null;
	periodStart: string | null;
	subscriptionStatus: string | null;
	featureOverrides: Partial<PlanFeatures> | null;
	/** Session metadata from checkout.session.completed (null for other events). */
	sessionMetadata: Record<string, string> | null;
	/** Invoice.paid: amount charged in cents (post-discount, pre-tax). */
	invoiceAmountCents?: number | null;
	/** Invoice.paid: Stripe invoice ID (for idempotency). */
	invoiceId?: string | null;
	/** charge.refunded (#299): the affected invoice id (in_...). */
	clawbackInvoiceId?: string | null;
	/**
	 * charge.dispute.created (#475): the disputed charge id (ch_...).
	 * Invoice is resolved in the route handler via stripe.charges.retrieve
	 * because the dispute event doesn't carry the invoice id directly.
	 */
	clawbackChargeId?: string | null;
	/** "refund" | "chargeback". */
	clawbackReason?: "refund" | "chargeback" | null;
}

export type BillingErrorCode =
	| "INVALID_PLAN"
	| "CHECKOUT_REJECTED"
	| "PRICE_NOT_CONFIGURED"
	| "MISSING_CUSTOMER"
	| "WEBHOOK_SIGNATURE_INVALID"
	| "STRIPE_API_ERROR";

export class BillingError extends Error {
	constructor(
		public readonly code: BillingErrorCode,
		message: string,
	) {
		super(message);
		this.name = "BillingError";
	}
}
