/**
 * Client-side conversion tracking helper (#200).
 *
 * Fires page-level conversion events to /api/public/audit/[jobId]/events.
 * Silently swallows failures — tracking must never block the user flow.
 */

export type ConversionEventType =
	| "page_visit"
	| "audit_submitted"
	| "teaser_viewed"
	| "email_entered"
	| "report_viewed"
	| "signup_initiated";

export interface TrackEventOptions {
	jobId: string;
	eventType: ConversionEventType;
	metadata?: Record<string, unknown>;
}

export async function trackConversionEvent(opts: TrackEventOptions): Promise<void> {
	try {
		await fetch(`/api/public/audit/${opts.jobId}/events`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ eventType: opts.eventType, metadata: opts.metadata ?? null }),
			// Fire-and-forget; keepalive lets the beacon survive page unload.
			keepalive: true,
		});
	} catch {
		/* swallow — tracking is best-effort. */
	}
}
