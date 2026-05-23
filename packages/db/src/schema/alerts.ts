import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const alerts = pgTable("alerts", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.references(() => profiles.id, { onDelete: "cascade" })
		.notNull(),
	type: text("type").notNull(), // "visibility_drop", "new_citation", "competitor_gain"
	channel: text("channel").notNull(), // "email", "slack", "webhook"
	config: jsonb("config").default("{}"),
	enabled: boolean("enabled").default(true),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdateFn(() => new Date()),
});

export const alertEvents = pgTable("alert_events", {
	id: uuid("id").primaryKey().defaultRandom(),
	alertId: uuid("alert_id")
		.references(() => alerts.id, { onDelete: "cascade" })
		.notNull(),
	payload: jsonb("payload").notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const alertsRelations = relations(alerts, ({ one, many }) => ({
	user: one(profiles, {
		fields: [alerts.userId],
		references: [profiles.id],
	}),
	events: many(alertEvents),
}));

export const alertEventsRelations = relations(alertEvents, ({ one }) => ({
	alert: one(alerts, {
		fields: [alertEvents.alertId],
		references: [alerts.id],
	}),
}));
