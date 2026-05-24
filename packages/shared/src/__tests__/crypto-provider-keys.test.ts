import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetKeyCacheForTests, decryptProviderKey, encryptProviderKey } from "../crypto-aes-gcm";

const KEY_BASE64 = Buffer.from("p".repeat(32)).toString("base64");

describe("provider key encryption", () => {
	beforeEach(() => {
		process.env.PROVIDER_KEYS_KEY = KEY_BASE64;
		__resetKeyCacheForTests();
	});
	afterEach(() => {
		__resetKeyCacheForTests();
	});

	it("round-trips with the engine AAD", () => {
		const envelope = encryptProviderKey({ plaintext: "sk-test-123", aad: "provider:claude" });
		expect(decryptProviderKey({ envelope, aad: "provider:claude" })).toBe("sk-test-123");
	});

	it("is bound to the engine AAD (can't decrypt as another engine)", () => {
		const envelope = encryptProviderKey({ plaintext: "sk-test-123", aad: "provider:claude" });
		expect(() => decryptProviderKey({ envelope, aad: "provider:chatgpt" })).toThrow();
	});

	it("uses the provider-v1 kid", () => {
		const envelope = encryptProviderKey({ plaintext: "x", aad: "provider:gemini" });
		expect(JSON.parse(envelope).kid).toBe("provider-v1");
	});
});
