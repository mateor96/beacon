import { REFERRAL_TERMS_PATH } from "./terms.js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.example.com";
const AFFILIATE_DASHBOARD_PATH = "/dashboard/referral";

export interface ReferralEmailPayload {
	to: string;
	/** Stable identifier used for dedupe via emailLogId. */
	idempotencyKey: string;
	data: {
		kind: "application_received" | "approved" | "rejected" | "conversion" | "payout_processed";
		rejectionReason?: string;
		firstLinkCode?: string;
		conversionAmountCents?: number;
		payoutAmountCents?: number;
	};
}

/**
 * Enqueue a referral email. Uses the shared email queue + templates, so
 * callers (enrollment, approval, recurring-commission, payout) stay thin.
 */
export async function sendReferralEmail(payload: ReferralEmailPayload): Promise<void> {
	try {
		const { templates } = await import("@beacon/notifications");
		const { addJob } = await import("@beacon/queue");
		const rendered = templates["referral-notification"](
			{
				...payload.data,
				dashboardUrl: `${APP_URL}${AFFILIATE_DASHBOARD_PATH}`,
				termsUrl: `${APP_URL}${REFERRAL_TERMS_PATH}`,
			},
			"",
		);
		await addJob("email", {
			emailLogId: payload.idempotencyKey,
			to: [payload.to],
			from: process.env.EMAIL_FROM ?? "noreply@example.com",
			subject: rendered.subject,
			html: rendered.html,
			text: rendered.text,
		});
	} catch (err) {
		console.error("[referral] sendReferralEmail failed", {
			kind: payload.data.kind,
			idempotencyKey: payload.idempotencyKey,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}
