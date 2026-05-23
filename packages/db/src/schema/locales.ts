import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { monitoringProjects } from "./monitoring";

// ── locales ─────────────────────────────────────────────────

export const locales = pgTable(
	"locales",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		countryCode: text("country_code").notNull(), // ISO 3166-1 alpha-2 (uppercase, e.g. "DE")
		languageCode: text("language_code").notNull(), // ISO 639-1 (lowercase, e.g. "de")
		displayName: text("display_name").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		/**
		 * Free-form context shipped with the locale: popular AI assistants,
		 * regional search engines, market-specific standards. Consumed by the
		 * prompt template renderer (see #199).
		 */
		regionContext: jsonb("region_context").$type<Record<string, unknown> | null>(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("idx_locales_country_language_uniq").on(table.countryCode, table.languageCode),
		index("idx_locales_active").on(table.isActive).where(sql`${table.isActive} = true`),
	],
);

// ── domain_locales (junction) ────────────────────────────────

/**
 * Links a tracked "domain" (currently `monitoring_projects.id`) to a locale.
 * Each domain may have many locales but at most one primary, enforced by
 * the partial unique index `idx_domain_locales_primary_uniq`.
 */
export const domainLocales = pgTable(
	"domain_locales",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		domainId: uuid("domain_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		localeId: uuid("locale_id")
			.references(() => locales.id, { onDelete: "restrict" })
			.notNull(),
		isPrimary: boolean("is_primary").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("idx_domain_locales_pair_uniq").on(table.domainId, table.localeId),
		uniqueIndex("idx_domain_locales_primary_uniq")
			.on(table.domainId)
			.where(sql`${table.isPrimary} = true`),
		index("idx_domain_locales_locale").on(table.localeId),
	],
);

// ── prompt_templates ─────────────────────────────────────────

export const promptTemplates = pgTable(
	"prompt_templates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		localeId: uuid("locale_id")
			.references(() => locales.id, { onDelete: "cascade" })
			.notNull(),
		key: text("key").notNull(), // e.g. "brand_awareness", "competitor_comparison"
		content: text("content").notNull(),
		category: text("category"),
		variables: jsonb("variables").$type<string[] | null>(),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("idx_prompt_templates_locale_key_uniq").on(table.localeId, table.key),
		index("idx_prompt_templates_locale").on(table.localeId),
	],
);

// ── Relations ────────────────────────────────────────────────

export const localesRelations = relations(locales, ({ many }) => ({
	domainLocales: many(domainLocales),
	promptTemplates: many(promptTemplates),
}));

export const domainLocalesRelations = relations(domainLocales, ({ one }) => ({
	domain: one(monitoringProjects, {
		fields: [domainLocales.domainId],
		references: [monitoringProjects.id],
	}),
	locale: one(locales, {
		fields: [domainLocales.localeId],
		references: [locales.id],
	}),
}));

export const promptTemplatesRelations = relations(promptTemplates, ({ one }) => ({
	locale: one(locales, {
		fields: [promptTemplates.localeId],
		references: [locales.id],
	}),
}));

// ── Type exports ─────────────────────────────────────────────

export type Locale = typeof locales.$inferSelect;
export type NewLocale = typeof locales.$inferInsert;
export type DomainLocale = typeof domainLocales.$inferSelect;
export type NewDomainLocale = typeof domainLocales.$inferInsert;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;
