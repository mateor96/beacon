import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { locales } from "./locales";
import { monitoringProjects } from "./monitoring";

export const competitors = pgTable(
	"competitors",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		name: text("name").notNull(),
		domain: text("domain"),
		aliases: jsonb("aliases").notNull().default([]),
		/**
		 * Industry classification — free-text, ambient metadata for admin UI.
		 * NOT constrained to the SupportedIndustry union in @beacon/ai because
		 * real-world competitor domains frequently sit outside our 8-bucket
		 * taxonomy. The AI-suggested-prompts flow uses a narrower enum; this
		 * column is deliberately permissive (#178).
		 */
		industry: text("industry"),
		/**
		 * Optional locale scope (#248). NULL = competitor applies across all
		 * locales of the project; non-null = this competitor is only tracked
		 * for the given locale. Lets the same project run different
		 * competitor sets per market.
		 */
		localeId: uuid("locale_id").references(() => locales.id, { onDelete: "set null" }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		index("idx_competitors_project").on(table.projectId),
		index("idx_competitors_project_locale").on(table.projectId, table.localeId),
		/**
		 * Partial unique: prevents duplicate (project, domain) pairs while
		 * tolerating multiple "domain-less" rows (name-only competitors).
		 * Scoping is at project level — locale_id is intentionally excluded
		 * so the same physical domain can't be tracked twice per project
		 * even across different locales (matches issue #178 spec).
		 */
		uniqueIndex("idx_competitors_project_domain_uniq")
			.on(table.projectId, table.domain)
			.where(sql`${table.domain} IS NOT NULL`),
	],
);

export const competitorsRelations = relations(competitors, ({ one }) => ({
	project: one(monitoringProjects, {
		fields: [competitors.projectId],
		references: [monitoringProjects.id],
	}),
	locale: one(locales, {
		fields: [competitors.localeId],
		references: [locales.id],
	}),
}));
