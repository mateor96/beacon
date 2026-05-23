import type Stripe from "stripe";
import { getStripePriceId } from "./prices.js";
import type { CheckoutParams, CheckoutResult, StripePriceMap } from "./types.js";
import { BillingError } from "./types.js";

export async function createCheckoutSession(
	stripe: Stripe,
	priceMap: StripePriceMap,
	params: CheckoutParams,
): Promise<CheckoutResult> {
	if (params.plan === "free") {
		throw new BillingError("CHECKOUT_REJECTED", "Free-Plan benoetigt kein Checkout.");
	}
	if (params.plan === "enterprise") {
		throw new BillingError("CHECKOUT_REJECTED", "Enterprise-Plan nur über Vertrieb buchbar.");
	}

	const priceId = getStripePriceId(priceMap, params.plan, params.interval);

	const sharedMetadata: Record<string, string> = {
		userId: params.userId,
		plan: params.plan,
		interval: params.interval,
	};
	if (params.baselineUrl) {
		// Stripe metadata values are strings ≤ 500 chars
		sharedMetadata.baselineUrl = params.baselineUrl.slice(0, 500);
	}
	if (params.guaranteeTermsVersion) {
		sharedMetadata.guaranteeTermsVersion = params.guaranteeTermsVersion.slice(0, 100);
	}

	const session = await stripe.checkout.sessions.create({
		mode: "subscription",
		client_reference_id: params.userId,
		customer: params.existingCustomerId,
		customer_email: params.existingCustomerId ? undefined : params.email,
		line_items: [{ price: priceId, quantity: 1 }],
		subscription_data: {
			metadata: sharedMetadata,
		},
		metadata: sharedMetadata,
		success_url: params.successUrl,
		cancel_url: params.cancelUrl,
		allow_promotion_codes: true,
	});

	if (!session.url) {
		throw new BillingError(
			"STRIPE_API_ERROR",
			"Stripe hat keine Checkout-URL für die Session zurückgegeben.",
		);
	}

	return {
		sessionId: session.id,
		url: session.url,
	};
}
