/**
 * CRM / email-marketing adapter (#226). Pluggable so the repo can swap
 * between Resend, Loops, Mailchimp, or a custom HTTP endpoint without
 * touching consumer code.
 *
 * Consumers get `publishLead()` to push a lead into their CRM; the
 * default NullCrmAdapter is a no-op useful for dev and testing.
 */

export interface LeadPayload {
	email: string;
	companyName: string | null;
	auditUrl: string;
	overallScore: number;
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	/** ISO 8601 timestamp when the lead was captured. */
	capturedAt: string;
}

export interface CrmAdapter {
	/** Adapter id, for logs / metrics. */
	readonly id: string;
	publishLead(payload: LeadPayload): Promise<void>;
}

export class NullCrmAdapter implements CrmAdapter {
	readonly id = "null";
	async publishLead(_payload: LeadPayload): Promise<void> {
		/* no-op */
	}
}

/**
 * Minimal Resend-compatible adapter — pushes the lead as a tagged contact
 * via the Resend Audiences API. Tokens, audience ids, and tags are
 * injected by the caller so this stays deployable without coupling to
 * any runtime config framework.
 */
export class ResendCrmAdapter implements CrmAdapter {
	readonly id = "resend";

	constructor(
		private readonly opts: {
			apiKey: string;
			audienceId: string;
			fetchImpl?: typeof fetch;
		},
	) {}

	async publishLead(payload: LeadPayload): Promise<void> {
		const fetchFn = this.opts.fetchImpl ?? fetch;
		const body = {
			email: payload.email,
			first_name: payload.companyName ?? undefined,
			unsubscribed: false,
		};
		const res = await fetchFn(`https://api.resend.com/audiences/${this.opts.audienceId}/contacts`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.opts.apiKey}`,
			},
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			// 409 means "already exists" — not an error for our purposes
			if (res.status === 409) return;
			const text = await res.text().catch(() => "");
			throw new Error(`Resend CRM error: ${res.status} ${text.slice(0, 200)}`);
		}
	}
}

/**
 * Resolves the active CRM adapter from environment variables:
 *   CRM_ADAPTER=resend RESEND_API_KEY=... RESEND_AUDIENCE_ID=...
 * Returns NullCrmAdapter when unconfigured.
 */
export function resolveCrmAdapter(env: NodeJS.ProcessEnv = process.env): CrmAdapter {
	const id = env.CRM_ADAPTER?.toLowerCase();
	if (id === "resend" && env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID) {
		return new ResendCrmAdapter({
			apiKey: env.RESEND_API_KEY,
			audienceId: env.RESEND_AUDIENCE_ID,
		});
	}
	return new NullCrmAdapter();
}

/** Pure helper — builds the normalized payload from raw lead inputs. */
export function buildLeadPayload(input: {
	email: string;
	companyName: string | null;
	auditUrl: string;
	overallScore: number;
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	capturedAt?: Date;
}): LeadPayload {
	return {
		email: input.email,
		companyName: input.companyName,
		auditUrl: input.auditUrl,
		overallScore: input.overallScore,
		utmSource: input.utmSource,
		utmMedium: input.utmMedium,
		utmCampaign: input.utmCampaign,
		capturedAt: (input.capturedAt ?? new Date()).toISOString(),
	};
}
