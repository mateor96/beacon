import type { PlanName } from "@beacon/shared";
import { BillingError, type BillingInterval, type StripePriceMap } from "./types.js";

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new BillingError(
			"PRICE_NOT_CONFIGURED",
			`Fehlende Umgebungsvariable: ${key}. Stripe Price ID in .env eintragen.`,
		);
	}
	return value;
}

export function loadStripePriceMap(): StripePriceMap {
	const map: StripePriceMap = {
		starter: {
			monthly: requireEnv("STRIPE_PRICE_STARTER_MONTHLY"),
			yearly: requireEnv("STRIPE_PRICE_STARTER_YEARLY"),
		},
		pro: {
			monthly: requireEnv("STRIPE_PRICE_PRO_MONTHLY"),
			yearly: requireEnv("STRIPE_PRICE_PRO_YEARLY"),
		},
		agency: {
			monthly: requireEnv("STRIPE_PRICE_AGENCY_MONTHLY"),
			yearly: requireEnv("STRIPE_PRICE_AGENCY_YEARLY"),
		},
		enterprise: {
			monthly: requireEnv("STRIPE_PRICE_ENTERPRISE_MONTHLY"),
		},
	};

	const seen = new Map<string, string>();
	for (const [plan, intervals] of Object.entries(map)) {
		for (const [interval, priceId] of Object.entries(intervals as Record<string, string>)) {
			const existing = seen.get(priceId);
			if (existing) {
				throw new BillingError(
					"PRICE_NOT_CONFIGURED",
					`Doppelte Stripe Price ID "${priceId}": ${existing} und ${plan}/${interval}.`,
				);
			}
			seen.set(priceId, `${plan}/${interval}`);
		}
	}

	return map;
}

export function getStripePriceId(
	map: StripePriceMap,
	plan: PlanName,
	interval: BillingInterval,
): string {
	if (plan === "free") {
		throw new BillingError("INVALID_PLAN", "Free-Plan hat keine Stripe Price ID.");
	}
	if (plan === "enterprise" && interval === "yearly") {
		throw new BillingError(
			"CHECKOUT_REJECTED",
			"Enterprise-Jahresabo nur über Vertrieb verfügbar.",
		);
	}

	const planPrices = map[plan as keyof StripePriceMap];
	if (!planPrices) {
		throw new BillingError("INVALID_PLAN", `Unbekannter Plan: ${plan}`);
	}

	const priceId = (planPrices as Record<string, string>)[interval];
	if (!priceId) {
		throw new BillingError(
			"PRICE_NOT_CONFIGURED",
			`Keine Price ID für ${plan}/${interval} konfiguriert.`,
		);
	}

	return priceId;
}

export function lookupPlanByPriceId(
	map: StripePriceMap,
	priceId: string,
): { plan: PlanName; interval: BillingInterval } | null {
	for (const [plan, intervals] of Object.entries(map)) {
		for (const [interval, id] of Object.entries(intervals as Record<string, string>)) {
			if (id === priceId) {
				return { plan: plan as PlanName, interval: interval as BillingInterval };
			}
		}
	}
	return null;
}
