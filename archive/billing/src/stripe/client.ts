import Stripe from "stripe";
import { BillingError } from "./types.js";

export function createStripeClient(secretKey?: string): Stripe {
	const key = secretKey ?? process.env.STRIPE_SECRET_KEY;
	if (!key) {
		throw new BillingError("STRIPE_API_ERROR", "STRIPE_SECRET_KEY ist nicht gesetzt.");
	}
	return new Stripe(key);
}
