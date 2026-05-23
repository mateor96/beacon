import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.references(() => profiles.id, { onDelete: "cascade" })
			.notNull(),
		name: text("name").notNull(),
		keyHash: text("key_hash").notNull(),
		prefix: text("prefix").notNull(), // First 8 chars for identification
		scopes: text("scopes").array().default(["scan", "read"]),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		index("idx_api_keys_prefix").on(table.prefix),
		index("idx_api_keys_user").on(table.userId),
	],
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
	user: one(profiles, {
		fields: [apiKeys.userId],
		references: [profiles.id],
	}),
}));
