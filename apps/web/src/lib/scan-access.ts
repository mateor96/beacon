import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
	const secret = process.env.SCAN_ACCESS_SECRET;
	if (!secret) throw new Error("SCAN_ACCESS_SECRET is not set");
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
 * Mint a stateless HMAC-signed access token for a scan.
 * Format: `base64url(payload).base64url(hmac)`
 */
export function mintAccessToken(scanId: string, expiresAt: Date): string {
	const payload = base64urlEncode(JSON.stringify({ sid: scanId, exp: expiresAt.toISOString() }));
	const signature = hmac(payload);
	return `${payload}.${signature}`;
}

/**
 * Extract a single access token string, rejecting arrays (duplicate params).
 * Shared between SSR (get-scan.ts) and API (route.ts) paths.
 */
export function normalizeAccessToken(
	raw: string | string[] | null | undefined,
): string | undefined {
	if (typeof raw === "string") return raw;
	return undefined;
}

function getLegacyAnonCutoff(): Date | null {
	const raw = process.env.SCAN_ACCESS_LEGACY_CUTOFF;
	if (!raw) return null;
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

/**
 * Verify an access token against the given scan ID and expiry.
 * Uses timing-safe comparison to prevent side-channel attacks.
 */
export function verifyAccessToken(token: unknown, scanId: string, scanExpiresAt: Date): boolean {
	if (typeof token !== "string") return false;
	const parts = token.split(".");
	if (parts.length !== 2) return false;
	const [payload, signature] = parts;
	if (!payload || !signature) return false;

	// Verify HMAC
	const expected = hmac(payload);
	const sigBuf = Buffer.from(signature, "base64url");
	const expectedBuf = Buffer.from(expected, "base64url");
	if (sigBuf.length !== expectedBuf.length) return false;
	if (!timingSafeEqual(sigBuf, expectedBuf)) return false;

	// Decode and verify claims
	let decoded: { sid?: string; exp?: string };
	try {
		decoded = JSON.parse(base64urlDecode(payload));
	} catch {
		return false;
	}

	if (decoded.sid !== scanId) return false;
	if (decoded.exp !== scanExpiresAt.toISOString()) return false;
	if (new Date(decoded.exp) <= new Date()) return false;

	return true;
}

export type AccessMode = "owner" | "token";

/**
 * Determine access mode for a scan. Returns null if access is denied.
 * Pure function — no framework dependencies.
 */
export function getScanAccess(
	scan: { userId: string | null; id: string; expiresAt: Date | null; scannedAt: Date },
	opts: { viewerUserId?: string | null; accessToken?: string | null },
): AccessMode | null {
	// Expired scans are denied for everyone
	if (scan.expiresAt && scan.expiresAt < new Date()) return null;

	// Owner access via session
	if (scan.userId && opts.viewerUserId === scan.userId) return "owner";

	// Token-based access
	if (opts.accessToken && scan.expiresAt) {
		if (verifyAccessToken(opts.accessToken, scan.id, scan.expiresAt)) return "token";
	}

	// Legacy compat: anonymous scans created before access-control rollout
	// are readable at bare URLs. Self-expires via retention (max 30 days).
	// Safe to remove after cutoff + 30 days (anonymous/free retention window).
	if (!scan.userId && !opts.accessToken) {
		const cutoff = getLegacyAnonCutoff();
		if (cutoff && scan.scannedAt < cutoff) return "token";
	}

	return null;
}
