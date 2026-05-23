import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { scans } from "./scans";

/**
 * Shareable report links (#268).
 *
 * One row per agency-issued share link. Token is stored in plaintext
 * (random 24-byte base64url, ~192 bits entropy) — hashing the token
 * would require re-hashing per lookup; the unique index + rate limit
 * guard against enumeration.
 *
 * passwordHash is optional: scrypt$<saltBase64>$<hashBase64>.
 */
export const reportShares = pgTable(
	"report_shares",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		reportId: uuid("report_id")
			.references(() => scans.id, { onDelete: "cascade" })
			.notNull(),
		userId: uuid("user_id")
			.references(() => profiles.id, { onDelete: "cascade" })
			.notNull(),
		shareToken: text("share_token").notNull(),
		passwordHash: text("password_hash"),
		expiresAt: timestamp("expires_at", { withTimezone: true })
			.notNull()
			.default(sql`NOW() + INTERVAL '30 days'`),
		isActive: boolean("is_active").notNull().default(true),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
		accessCount: integer("access_count").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_report_shares_token_uniq").on(table.shareToken),
		index("idx_report_shares_user_active").on(table.userId, table.isActive, table.expiresAt),
		index("idx_report_shares_report").on(table.reportId),
	],
);

export const reportSharesRelations = relations(reportShares, ({ one }) => ({
	report: one(scans, {
		fields: [reportShares.reportId],
		references: [scans.id],
	}),
	user: one(profiles, {
		fields: [reportShares.userId],
		references: [profiles.id],
	}),
}));

export type ReportShare = typeof reportShares.$inferSelect;
export type NewReportShare = typeof reportShares.$inferInsert;
