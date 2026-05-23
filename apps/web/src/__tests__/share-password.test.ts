import { describe, expect, it } from "vitest";
import { generateShareToken, hashSharePassword, verifySharePassword } from "../lib/share-password";

describe("hashSharePassword / verifySharePassword (#268)", () => {
	it("round-trips the correct password", () => {
		const hash = hashSharePassword("correct-horse-battery-staple");
		expect(verifySharePassword("correct-horse-battery-staple", hash)).toBe(true);
	});

	it("rejects the wrong password", () => {
		const hash = hashSharePassword("password1");
		expect(verifySharePassword("password2", hash)).toBe(false);
	});

	it("rejects a corrupted hash", () => {
		expect(verifySharePassword("x", "not-a-scrypt-hash")).toBe(false);
		expect(verifySharePassword("x", "scrypt$only-two-parts")).toBe(false);
		expect(verifySharePassword("x", "bcrypt$abc$def")).toBe(false);
	});

	it("different salts produce different hashes for the same password", () => {
		const a = hashSharePassword("same-password");
		const b = hashSharePassword("same-password");
		expect(a).not.toBe(b);
		expect(verifySharePassword("same-password", a)).toBe(true);
		expect(verifySharePassword("same-password", b)).toBe(true);
	});

	it("NFKC-normalizes unicode passwords", () => {
		// Two different encodings of the same visual string
		const decomposed = "cafe\u0301"; // "café" as e + combining acute
		const composed = "caf\u00e9"; // "café" as single e-acute
		const hash = hashSharePassword(decomposed);
		expect(verifySharePassword(composed, hash)).toBe(true);
	});
});

describe("generateShareToken", () => {
	it("returns a URL-safe string with sufficient entropy", () => {
		const t = generateShareToken();
		expect(t).toMatch(/^[A-Za-z0-9_-]+$/); // base64url alphabet
		expect(t.length).toBeGreaterThanOrEqual(30); // 24 bytes -> 32 base64url chars
	});

	it("generates distinct tokens", () => {
		const set = new Set(Array.from({ length: 20 }, () => generateShareToken()));
		expect(set.size).toBe(20);
	});
});
