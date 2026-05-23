import type Stripe from "stripe";
import type { PortalParams, PortalResult } from "./types.js";
import { BillingError } from "./types.js";

export async function createPortalSession(
	stripe: Stripe,
	params: PortalParams,
): Promise<PortalResult> {
	if (!params.customerId) {
		throw new BillingError(
			"MISSING_CUSTOMER",
			"Kein Stripe-Kunde vorhanden. Bitte zuerst ein Abo abschliessen.",
		);
	}

	const session = await stripe.billingPortal.sessions.create({
		customer: params.customerId,
		return_url: params.returnUrl,
	});

	if (!session.url) {
		throw new BillingError("STRIPE_API_ERROR", "Stripe hat keine Portal-URL zurückgegeben.");
	}

	return { url: session.url };
}
