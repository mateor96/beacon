import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
	const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
	if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET is not set");
	return secret;
}

function base64url(buf: Buffer): string {
	return buf.toString("base64url");
}

function base64urlEncode(str: string): string {
	return base64url(Buffer.from(str, "utf-8"));
}

function base64urlDecode(str: string): string {
	return Buffer.from(str, "base64url").toString("utf-8");
}

function hmac(payload: string): string {
	return base64url(createHmac("sha256", getSecret()).update(payload).digest());
}

/**
 * Mint a stateless HMAC-signed unsubscribe token.
 * Format: `base64url(payload).base64url(hmac)`
 */
export function mintUnsubscribeToken(userId: string, category: string): string {
	const payload = base64urlEncode(JSON.stringify({ uid: userId, cat: category }));
	const signature = hmac(payload);
	return `${payload}.${signature}`;
}

/**
 * Verify an unsubscribe token and extract its claims.
 * Uses timing-safe comparison to prevent side-channel attacks.
 * Returns null if the token is invalid.
 */
export function verifyUnsubscribeToken(token: string): { userId: string; category: string } | null {
	const parts = token.split(".");
	if (parts.length !== 2) return null;

	const [payload, signature] = parts;
	if (!payload || !signature) return null;

	// Verify HMAC
	const expected = hmac(payload);
	const sigBuf = Buffer.from(signature, "base64url");
	const expectedBuf = Buffer.from(expected, "base64url");
	if (sigBuf.length !== expectedBuf.length) return null;
	if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

	// Decode claims
	let decoded: { uid?: string; cat?: string };
	try {
		decoded = JSON.parse(base64urlDecode(payload));
	} catch {
		return null;
	}

	if (typeof decoded.uid !== "string" || typeof decoded.cat !== "string") return null;

	return { userId: decoded.uid, category: decoded.cat };
}
