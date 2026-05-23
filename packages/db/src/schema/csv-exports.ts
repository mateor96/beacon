import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ── Enum constants ──────────────────────────────────────────

export const CSV_EXPORT_STATUSES = [
	"pending",
	"processing",
	"completed",
	"failed",
	"expired",
] as const;
export type CsvExportStatus = (typeof CSV_EXPORT_STATUSES)[number];

export const CSV_EXPORT_ENTITIES = [
	"scans",
	"citations",
	"competitor_scan_results",
	"domain_locales",
] as const;
export type CsvExportEntity = (typeof CSV_EXPORT_ENTITIES)[number];

// ── csv_exports ──────────────────────────────────────────────

export const csvExports = pgTable(
	"csv_exports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		entity: text("entity", { enum: CSV_EXPORT_ENTITIES }).notNull(),
		/** Column ids included in the output. NULL = default set. */
		columns: jsonb("columns").$type<string[] | null>(),
		/** Optional date-range filter on the entity's primary timestamp. */
		dateFrom: timestamp("date_from", { withTimezone: true }),
		dateTo: timestamp("date_to", { withTimezone: true }),
		status: text("status", { enum: CSV_EXPORT_STATUSES }).notNull().default("pending"),
		progress: integer("progress").notNull().default(0), // 0..100
		rowCount: bigint("row_count", { mode: "number" }).notNull().default(0),
		fileBytes: bigint("file_bytes", { mode: "number" }).notNull().default(0),
		storageKey: text("storage_key"),
		downloadUrl: text("download_url"),
		urlExpiresAt: timestamp("url_expires_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_csv_exports_created").on(table.createdAt.desc()),
		index("idx_csv_exports_status").on(table.status),
	],
);

// ── Type exports ────────────────────────────────────────────

export type CsvExport = typeof csvExports.$inferSelect;
export type NewCsvExport = typeof csvExports.$inferInsert;
