import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Instance-scoped AI provider API keys, stored as AES-256-GCM envelopes
 * (`encrypted_value`). One row per engine. A present row overrides the
 * corresponding env var at runtime (no restart needed). Never store plaintext.
 */
export const providerKeys = pgTable("provider_keys", {
	engine: text("engine").primaryKey(),
	encryptedValue: text("encrypted_value").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date()),
});
