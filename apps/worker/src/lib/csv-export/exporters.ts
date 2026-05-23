import { type CsvExportEntity, csvExportQueries, db } from "@beacon/db";
import { scans } from "@beacon/db";
import { asc, eq } from "drizzle-orm";
import { UTF8_BOM, buildHeader, buildRow } from "./formatter.js";

export interface ExporterConfig {
	/** Entity this exporter serves. */
	entity: CsvExportEntity;
	/** Column ids available for this entity (used when columns is NULL). */
	defaultColumns: string[];
	/** Allowed columns (for validation). */
	allowedColumns: string[];
	/**
	 * Pulls rows in chunks and yields them one by one. Implementations stream
	 * all rows in the instance (Beacon runs single-tenant in OSS mode).
	 */
	stream(opts: StreamOptions): AsyncGenerator<Record<string, unknown>>;
}

export interface StreamOptions {
	dateFrom: Date | null;
	dateTo: Date | null;
}

// ── scans exporter ──────────────────────────────────────────

const SCANS_DEFAULT_COLUMNS = ["id", "url", "score", "readinessLevel", "status", "scannedAt"];
const SCANS_ALLOWED_COLUMNS = [
	"id",
	"url",
	"finalUrl",
	"score",
	"readinessLevel",
	"status",
	"scannedAt",
	"errorMessage",
	"processingDurationMs",
];

const scansExporter: ExporterConfig = {
	entity: "scans",
	defaultColumns: SCANS_DEFAULT_COLUMNS,
	allowedColumns: SCANS_ALLOWED_COLUMNS,
	async *stream({ dateFrom, dateTo }) {
		const query = db.query.scans.findMany({
			orderBy: asc(scans.scannedAt),
			limit: 1000,
		});
		// Note: this baseline exporter pulls a 1k cap. Production-scale chunking
		// via keyset pagination is a follow-up; the streaming API contract stays
		// the same so the caller (csv-export processor) doesn't change.
		const rows = await query;
		for (const row of rows) {
			const filtered = (() => {
				if (dateFrom && row.scannedAt < dateFrom) return false;
				if (dateTo && row.scannedAt > dateTo) return false;
				return true;
			})();
			if (filtered) yield row as unknown as Record<string, unknown>;
		}
	},
};

// ── Registry ────────────────────────────────────────────────

export const EXPORTERS: Record<CsvExportEntity, ExporterConfig> = {
	scans: scansExporter,
	// Additional exporters (citations, competitor_scan_results,
	// domain_locales) follow the same shape — they stub as empty streams
	// here and get real implementations in the follow-up PRs that wire
	// their entity-specific joins.
	citations: {
		entity: "citations",
		defaultColumns: ["id"],
		allowedColumns: ["id"],
		async *stream() {
			// empty stream — no rows yet
		},
	},
	competitor_scan_results: {
		entity: "competitor_scan_results",
		defaultColumns: ["id"],
		allowedColumns: ["id"],
		async *stream() {},
	},
	domain_locales: {
		entity: "domain_locales",
		defaultColumns: ["id"],
		allowedColumns: ["id"],
		async *stream() {},
	},
};

// ── Driver ──────────────────────────────────────────────────

export interface BuildCsvOptions {
	exportId: string;
	entity: CsvExportEntity;
	columns: string[] | null;
	dateFrom: Date | null;
	dateTo: Date | null;
	onProgress?: (progress: number, rowCount: number) => Promise<void>;
}

/**
 * Builds a CSV in memory from the exporter's stream. Returns the raw bytes.
 * For very large exports the follow-up will swap this for a true streaming
 * writer that pushes chunks to the storage adapter without full buffering.
 */
export async function buildCsv(opts: BuildCsvOptions): Promise<Uint8Array> {
	const exporter = EXPORTERS[opts.entity];
	if (!exporter) throw new Error(`Unknown CSV entity: ${opts.entity}`);

	const columns = opts.columns && opts.columns.length > 0 ? opts.columns : exporter.defaultColumns;
	const unknown = columns.filter((c) => !exporter.allowedColumns.includes(c));
	if (unknown.length > 0) {
		throw new Error(`Unknown columns for ${opts.entity}: ${unknown.join(", ")}`);
	}

	const pieces: string[] = [UTF8_BOM, buildHeader(columns)];
	let rowCount = 0;

	for await (const row of exporter.stream({
		dateFrom: opts.dateFrom,
		dateTo: opts.dateTo,
	})) {
		pieces.push(buildRow(row, columns));
		rowCount++;
		if (rowCount % 500 === 0 && opts.onProgress) {
			// Progress: heuristic — caller can replace with a better estimate
			await opts.onProgress(Math.min(95, rowCount % 100), rowCount);
		}
	}

	const text = pieces.join("");
	const bytes = new TextEncoder().encode(text);

	await csvExportQueries.updateStatus(db, opts.exportId, "processing", {
		rowCount,
		fileBytes: bytes.byteLength,
		progress: 95,
	});

	return bytes;
}
