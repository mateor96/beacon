import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { scans } from "./scans";

export const siteCrawls = pgTable(
	"site_crawls",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.references(() => profiles.id, { onDelete: "cascade" })
			.notNull(),
		rootUrl: text("root_url").notNull(),
		status: text("status", {
			enum: ["pending", "crawling", "completed", "failed"],
		})
			.notNull()
			.default("pending"),
		pagesFound: integer("pages_found").default(0),
		pagesScanned: integer("pages_scanned").default(0),
		avgScore: integer("avg_score"),
		weakestPages: jsonb("weakest_pages"),
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [index("idx_site_crawls_user").on(table.userId, table.startedAt.desc())],
);

export const siteCrawlPages = pgTable(
	"site_crawl_pages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		crawlId: uuid("crawl_id")
			.references(() => siteCrawls.id, { onDelete: "cascade" })
			.notNull(),
		scanId: uuid("scan_id").references(() => scans.id, { onDelete: "set null" }),
		url: text("url").notNull(),
		depth: integer("depth").notNull(), // 0 = root
		status: text("status", {
			enum: ["pending", "scanning", "completed", "failed"],
		})
			.notNull()
			.default("pending"),
	},
	(table) => [index("idx_site_crawl_pages_crawl").on(table.crawlId, table.status)],
);

// Relations
export const siteCrawlsRelations = relations(siteCrawls, ({ one, many }) => ({
	user: one(profiles, {
		fields: [siteCrawls.userId],
		references: [profiles.id],
	}),
	pages: many(siteCrawlPages),
}));

export const siteCrawlPagesRelations = relations(siteCrawlPages, ({ one }) => ({
	crawl: one(siteCrawls, {
		fields: [siteCrawlPages.crawlId],
		references: [siteCrawls.id],
	}),
	scan: one(scans, {
		fields: [siteCrawlPages.scanId],
		references: [scans.id],
	}),
}));
