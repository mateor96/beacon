import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Compute an HMAC-SHA256 hex digest for a webhook payload.
 */
export function signWebhookPayload(secret: string, payload: string): string {
	return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify a webhook signature against the expected HMAC.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
	secret: string,
	payload: string,
	signature: string,
): boolean {
	const expected = signWebhookPayload(secret, payload);
	if (expected.length !== signature.length) return false;
	return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
