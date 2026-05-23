import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const waitlistSignups = pgTable(
	"waitlist_signups",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: text("email").notNull(),
		companyName: text("company_name"),
		websiteUrl: text("website_url"),
		status: text("status", {
			enum: ["pending", "confirmed", "unsubscribed"],
		})
			.notNull()
			.default("pending"),
		confirmToken: text("confirm_token").notNull(),
		confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
		consentGivenAt: timestamp("consent_given_at", { withTimezone: true }).notNull().defaultNow(),
		source: text("source").default("landing"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_waitlist_email").on(table.email),
		index("idx_waitlist_confirm_token").on(table.confirmToken),
	],
);
