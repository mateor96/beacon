/**
 * Share-link password hashing (#268).
 *
 * Uses Node's built-in scrypt — no external deps. Format:
 *   scrypt$<saltBase64url>$<hashBase64url>
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 64;

export function hashSharePassword(password: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LEN, {
		N: SCRYPT_N,
		r: SCRYPT_r,
		p: SCRYPT_p,
	});
	return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifySharePassword(password: string, stored: string): boolean {
	const parts = stored.split("$");
	if (parts.length !== 3 || parts[0] !== "scrypt") return false;
	const saltB64 = parts[1];
	const hashB64 = parts[2];
	if (!saltB64 || !hashB64) return false;

	let salt: Buffer;
	let expected: Buffer;
	try {
		salt = Buffer.from(saltB64, "base64url");
		expected = Buffer.from(hashB64, "base64url");
	} catch {
		return false;
	}

	const actual = scryptSync(password.normalize("NFKC"), salt, expected.length, {
		N: SCRYPT_N,
		r: SCRYPT_r,
		p: SCRYPT_p,
	});
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Generates a cryptographically random URL-safe share token (~192 bits). */
export function generateShareToken(): string {
	return randomBytes(24).toString("base64url");
}
