import { encryptProviderKey } from "@beacon/shared/crypto-aes-gcm";
import { beforeEach, describe, expect, it } from "vitest";
import * as pk from "../queries/provider-keys.js";

const KEY_BASE64 = Buffer.from("p".repeat(32)).toString("base64");

function selectDb(rows: unknown[]) {
	return { select: () => ({ from: () => Promise.resolve(rows) }) };
}

describe("resolveProviderKeys", () => {
	beforeEach(() => {
		process.env.PROVIDER_KEYS_KEY = KEY_BASE64;
	});

	it("decrypts stored keys into an engine→key map", async () => {
		const rows = [
			{
				engine: "claude",
				encryptedValue: encryptProviderKey({ plaintext: "sk-claude", aad: "provider:claude" }),
				updatedAt: new Date(),
			},
		];
		// biome-ignore lint/suspicious/noExplicitAny: minimal db mock
		const out = await pk.resolveProviderKeys(selectDb(rows) as any);
		expect(out).toEqual({ claude: "sk-claude" });
	});

	it("skips undecryptable rows instead of throwing", async () => {
		const rows = [{ engine: "claude", encryptedValue: "not-an-envelope", updatedAt: new Date() }];
		// biome-ignore lint/suspicious/noExplicitAny: minimal db mock
		const out = await pk.resolveProviderKeys(selectDb(rows) as any);
		expect(out).toEqual({});
	});
});
