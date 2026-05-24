import { decryptProviderKey, encryptProviderKey } from "@beacon/shared/crypto-aes-gcm";
import { eq } from "drizzle-orm";
import type { DbClient } from "../client";
import { providerKeys } from "../schema/provider-keys";

export type ProviderEngine = "claude" | "chatgpt" | "perplexity" | "gemini";

export const PROVIDER_ENGINES: ProviderEngine[] = ["claude", "chatgpt", "perplexity", "gemini"];

// AAD binds each envelope to its engine, so a row can't be swapped to another.
const aadFor = (engine: ProviderEngine) => `provider:${engine}`;

/** Encrypt + upsert a provider key. */
export async function setKey(db: DbClient, engine: ProviderEngine, plaintext: string) {
	const encryptedValue = encryptProviderKey({ plaintext, aad: aadFor(engine) });
	await db
		.insert(providerKeys)
		.values({ engine, encryptedValue })
		.onConflictDoUpdate({
			target: providerKeys.engine,
			set: { encryptedValue, updatedAt: new Date() },
		});
}

/** Decrypt a single stored key, or null if absent/undecryptable. */
export async function getDecrypted(db: DbClient, engine: ProviderEngine): Promise<string | null> {
	const row = await db.query.providerKeys.findFirst({
		where: eq(providerKeys.engine, engine),
	});
	if (!row) return null;
	try {
		return decryptProviderKey({ envelope: row.encryptedValue, aad: aadFor(engine) });
	} catch {
		return null;
	}
}

/** Which engines have a DB key + when set. Never returns the value. */
export async function listStatus(db: DbClient) {
	return db
		.select({ engine: providerKeys.engine, updatedAt: providerKeys.updatedAt })
		.from(providerKeys);
}

export async function remove(db: DbClient, engine: ProviderEngine) {
	return db.delete(providerKeys).where(eq(providerKeys.engine, engine)).returning();
}

/**
 * Resolves all DB-stored provider keys (decrypted) as an injectable map.
 * Engines without a DB key are omitted, so callers fall back to env. Bad
 * envelopes are skipped rather than throwing.
 */
export async function resolveProviderKeys(
	db: DbClient,
): Promise<Partial<Record<ProviderEngine, string>>> {
	const rows = await db.select().from(providerKeys);
	const out: Partial<Record<ProviderEngine, string>> = {};
	for (const row of rows) {
		const engine = row.engine as ProviderEngine;
		try {
			out[engine] = decryptProviderKey({ envelope: row.encryptedValue, aad: aadFor(engine) });
		} catch {
			// skip undecryptable rows (e.g. wrong/rotated key)
		}
	}
	return out;
}
