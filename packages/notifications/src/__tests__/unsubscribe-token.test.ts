import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mintUnsubscribeToken, verifyUnsubscribeToken } from "../unsubscribe/token.js";

// ── Unsubscribe Token Tests ─────────────────────────────────

describe("unsubscribe token", () => {
	const TEST_SECRET = "test-secret-key-for-hmac-signing";

	beforeEach(() => {
		vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", TEST_SECRET);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("mint + verify round-trip succeeds", () => {
		const token = mintUnsubscribeToken("user-42", "marketing");
		const result = verifyUnsubscribeToken(token);

		expect(result).not.toBeNull();
		expect(result?.userId).toBe("user-42");
		expect(result?.category).toBe("marketing");
	});

	it("tampered token returns null", () => {
		const token = mintUnsubscribeToken("user-42", "marketing");
		// Flip a character in the signature portion
		const parts = token.split(".");
		const tampered = `${parts[0]}.${parts[1]?.slice(0, -1)}X`;
		const result = verifyUnsubscribeToken(tampered);

		expect(result).toBeNull();
	});

	it("wrong secret returns null", () => {
		const token = mintUnsubscribeToken("user-42", "marketing");

		// Change the secret for verification
		vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", "different-secret");
		const result = verifyUnsubscribeToken(token);

		expect(result).toBeNull();
	});

	it("token contains userId and category", () => {
		const token = mintUnsubscribeToken("usr_abc123", "scan-alerts");
		const result = verifyUnsubscribeToken(token);

		expect(result).toEqual({
			userId: "usr_abc123",
			category: "scan-alerts",
		});
	});
});
