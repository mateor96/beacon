import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "../webhooks/hmac.js";

const SECRET = "whsec_test_secret_key";
const PAYLOAD = JSON.stringify({ event: "scan.completed", data: { scanId: "abc-123" } });

describe("signWebhookPayload", () => {
	it("returns a hex string", () => {
		const sig = signWebhookPayload(SECRET, PAYLOAD);
		expect(sig).toMatch(/^[0-9a-f]{64}$/);
	});

	it("matches manual HMAC-SHA256 computation", () => {
		const expected = createHmac("sha256", SECRET).update(PAYLOAD).digest("hex");
		expect(signWebhookPayload(SECRET, PAYLOAD)).toBe(expected);
	});
});

describe("verifyWebhookSignature", () => {
	it("returns true for a valid signature", () => {
		const sig = signWebhookPayload(SECRET, PAYLOAD);
		expect(verifyWebhookSignature(SECRET, PAYLOAD, sig)).toBe(true);
	});

	it("returns false for a tampered payload", () => {
		const sig = signWebhookPayload(SECRET, PAYLOAD);
		const tampered = PAYLOAD.replace("abc-123", "xyz-999");
		expect(verifyWebhookSignature(SECRET, tampered, sig)).toBe(false);
	});

	it("returns false for a wrong secret", () => {
		const sig = signWebhookPayload(SECRET, PAYLOAD);
		expect(verifyWebhookSignature("wrong-secret", PAYLOAD, sig)).toBe(false);
	});

	it("returns false when signature has different length", () => {
		expect(verifyWebhookSignature(SECRET, PAYLOAD, "tooshort")).toBe(false);
	});

	it("returns false for empty signature", () => {
		expect(verifyWebhookSignature(SECRET, PAYLOAD, "")).toBe(false);
	});
});
