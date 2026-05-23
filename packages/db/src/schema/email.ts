import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const emailLog = pgTable(
	"email_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
		recipientEmail: text("recipient_email").notNull(),
		template: text("template").notNull(),
		category: text("category").notNull(),
		subject: text("subject").notNull(),
		idempotencyKey: text("idempotency_key"),
		status: text("status", { enum: ["queued", "sent", "failed", "suppressed"] })
			.notNull()
			.default("queued"),
		providerMessageId: text("provider_message_id"),
		errorMessage: text("error_message"),
		scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_email_log_idempotency_key")
			.on(table.idempotencyKey)
			.where(sql`${table.idempotencyKey} IS NOT NULL`),
		index("idx_email_log_user_created").on(table.userId, table.createdAt),
		index("idx_email_log_status").on(table.status, table.createdAt),
	],
);

export const userEmailPreferences = pgTable(
	"user_email_preferences",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.references(() => profiles.id, { onDelete: "cascade" })
			.notNull(),
		category: text("category").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [uniqueIndex("idx_email_prefs_user_category").on(table.userId, table.category)],
);

export const emailLogRelations = relations(emailLog, ({ one }) => ({
	user: one(profiles, { fields: [emailLog.userId], references: [profiles.id] }),
}));

export const userEmailPreferencesRelations = relations(userEmailPreferences, ({ one }) => ({
	user: one(profiles, { fields: [userEmailPreferences.userId], references: [profiles.id] }),
}));
