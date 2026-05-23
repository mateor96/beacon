import { relations } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { siteCrawlPages } from "./crawls";
import { scans } from "./scans";

// ── Enum constants (repo convention: no pgEnum) ─────────────

export const CITATION_MATCH_TYPES = ["exact", "path", "fuzzy", "manual", "unmatched"] as const;
export type CitationMatchType = (typeof CITATION_MATCH_TYPES)[number];

export const CITATION_SNAPSHOT_TYPES = ["before", "after"] as const;
export type CitationSnapshotType = (typeof CITATION_SNAPSHOT_TYPES)[number];

// ── citations ───────────────────────────────────────────────

export const citations = pgTable(
	"citations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		auditId: uuid("audit_id")
			.references(() => scans.id, { onDelete: "cascade" })
			.notNull(),
		modelName: text("model_name").notNull(),
		queryText: text("query_text").notNull(),
		rawResponse: text("raw_response").notNull(),
		extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull().defaultNow(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		index("idx_citations_audit").on(table.auditId, table.extractedAt.desc()),
		index("idx_citations_model").on(table.modelName, table.extractedAt.desc()),
	],
);

// ── cited_pages ─────────────────────────────────────────────

export const citedPages = pgTable(
	"cited_pages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		url: text("url").notNull(),
		canonicalUrl: text("canonical_url"),
		domain: text("domain").notNull(),
		clientPageId: uuid("client_page_id").references(() => siteCrawlPages.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("idx_cited_pages_url_uniq").on(table.url),
		index("idx_cited_pages_domain").on(table.domain),
		index("idx_cited_pages_client_page").on(table.clientPageId),
	],
);

// ── citation_page_mappings ──────────────────────────────────

export const citationPageMappings = pgTable(
	"citation_page_mappings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		citationId: uuid("citation_id")
			.references(() => citations.id, { onDelete: "cascade" })
			.notNull(),
		citedPageId: uuid("cited_page_id")
			.references(() => citedPages.id, { onDelete: "cascade" })
			.notNull(),
		position: integer("position").notNull(),
		contextSnippet: text("context_snippet"),
		matchType: text("match_type", { enum: CITATION_MATCH_TYPES }).notNull(),
		matchConfidence: integer("match_confidence"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("idx_citation_page_mappings_unique").on(
			table.citationId,
			table.citedPageId,
			table.position,
		),
		index("idx_citation_page_mappings_cited_page").on(table.citedPageId),
		index("idx_citation_page_mappings_match_type").on(table.matchType),
	],
);

// ── citation_snapshots ──────────────────────────────────────

export const citationSnapshots = pgTable(
	"citation_snapshots",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		clientPageId: uuid("client_page_id")
			.references(() => siteCrawlPages.id, { onDelete: "cascade" })
			.notNull(),
		auditId: uuid("audit_id")
			.references(() => scans.id, { onDelete: "cascade" })
			.notNull(),
		snapshotType: text("snapshot_type", { enum: CITATION_SNAPSHOT_TYPES }).notNull(),
		totalCitations: integer("total_citations").notNull().default(0),
		modelBreakdown: jsonb("model_breakdown").$type<Record<string, number>>().notNull().default({}),
		capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		index("idx_citation_snapshots_client_page").on(table.clientPageId, table.capturedAt.desc()),
		index("idx_citation_snapshots_audit").on(table.auditId),
		index("idx_citation_snapshots_type").on(
			table.clientPageId,
			table.snapshotType,
			table.capturedAt.desc(),
		),
		index("idx_citation_snapshots_captured").on(table.capturedAt.desc()),
	],
);

// ── citation_url_aliases ────────────────────────────────────

export const citationUrlAliases = pgTable(
	"citation_url_aliases",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		url: text("url").notNull(),
		clientPageId: uuid("client_page_id")
			.references(() => siteCrawlPages.id, { onDelete: "cascade" })
			.notNull(),
		createdByUserId: uuid("created_by_user_id"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("idx_citation_url_aliases_url").on(table.url),
		index("idx_citation_url_aliases_client_page").on(table.clientPageId),
	],
);

// ── Relations ───────────────────────────────────────────────

export const citationsRelations = relations(citations, ({ one, many }) => ({
	audit: one(scans, {
		fields: [citations.auditId],
		references: [scans.id],
	}),
	mappings: many(citationPageMappings),
}));

export const citedPagesRelations = relations(citedPages, ({ one, many }) => ({
	clientPage: one(siteCrawlPages, {
		fields: [citedPages.clientPageId],
		references: [siteCrawlPages.id],
	}),
	mappings: many(citationPageMappings),
}));

export const citationPageMappingsRelations = relations(citationPageMappings, ({ one }) => ({
	citation: one(citations, {
		fields: [citationPageMappings.citationId],
		references: [citations.id],
	}),
	citedPage: one(citedPages, {
		fields: [citationPageMappings.citedPageId],
		references: [citedPages.id],
	}),
}));

export const citationSnapshotsRelations = relations(citationSnapshots, ({ one }) => ({
	clientPage: one(siteCrawlPages, {
		fields: [citationSnapshots.clientPageId],
		references: [siteCrawlPages.id],
	}),
	audit: one(scans, {
		fields: [citationSnapshots.auditId],
		references: [scans.id],
	}),
}));

export const citationUrlAliasesRelations = relations(citationUrlAliases, ({ one }) => ({
	clientPage: one(siteCrawlPages, {
		fields: [citationUrlAliases.clientPageId],
		references: [siteCrawlPages.id],
	}),
}));

// ── Types ───────────────────────────────────────────────────

export type Citation = typeof citations.$inferSelect;
export type NewCitation = typeof citations.$inferInsert;
export type CitedPage = typeof citedPages.$inferSelect;
export type NewCitedPage = typeof citedPages.$inferInsert;
export type CitationPageMapping = typeof citationPageMappings.$inferSelect;
export type NewCitationPageMapping = typeof citationPageMappings.$inferInsert;
export type CitationSnapshot = typeof citationSnapshots.$inferSelect;
export type NewCitationSnapshot = typeof citationSnapshots.$inferInsert;
export type CitationUrlAlias = typeof citationUrlAliases.$inferSelect;
export type NewCitationUrlAlias = typeof citationUrlAliases.$inferInsert;
