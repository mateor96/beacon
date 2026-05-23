import { randomBytes } from "node:crypto";
import type { DbClient } from "@beacon/db";
import { referralQueries } from "@beacon/db";

/**
 * URL-safe alphabet for referral codes. Excludes characters that are easy
 * to confuse (0/O, 1/I/l).
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const CODE_LENGTH = 8;

function generateCode(length = CODE_LENGTH): string {
	const bytes = randomBytes(length);
	let out = "";
	for (const byte of bytes) {
		out += ALPHABET[byte % ALPHABET.length];
	}
	return out;
}

/**
 * Generate a unique referral code, retrying on DB collisions. Ten attempts
 * is comfortably enough at the 56^8 ≈ 9.6e13 search space even for millions
 * of affiliates.
 */
export async function generateUniqueReferralCode(db: DbClient, maxAttempts = 10): Promise<string> {
	for (let i = 0; i < maxAttempts; i++) {
		const code = generateCode();
		const existing = await referralQueries.getLinkByCode(db, code);
		if (!existing) return code;
	}
	throw new Error("Could not generate a unique referral code after max attempts");
}
