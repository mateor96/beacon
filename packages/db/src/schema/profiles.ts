import type { BrandingConfig } from "@beacon/shared";
import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * In the open-source distribution, profiles is a near-empty table.
 * It's preserved so future forks can re-enable auth without a schema
 * migration. No row is created automatically by any code path that
 * ships with the OSS build.
 */
export const profiles = pgTable("profiles", {
	id: uuid("id").primaryKey(),
	email: text("email").notNull(),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	role: text("role").notNull().default("user"),
	permissions: jsonb("permissions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
	reportBranding: jsonb("report_branding").$type<BrandingConfig>(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdateFn(() => new Date()),
});
