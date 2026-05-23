/**
 * Looker Studio Community Connector schema (#193).
 *
 * Defines the fields the Apps Script connector (#208) exposes to
 * Looker Studio and the mapping from Beacon database columns to Looker
 * data types. Also used by the backend data endpoint (#201) to
 * validate the `fields` query parameter.
 */

export type LookerDataType = "STRING" | "NUMBER" | "BOOLEAN" | "DATE";
export type LookerFieldKind = "DIMENSION" | "METRIC";

export interface LookerFieldSpec {
	/** Stable field id used in the connector schema and the `fields` query. */
	id: string;
	/** Human-readable label (English — Looker Studio is EN-first). */
	name: string;
	/** German description for the in-app Setup-Guide. */
	descriptionDe: string;
	kind: LookerFieldKind;
	dataType: LookerDataType;
	/** Source table in the Beacon database, for the mapping table in docs. */
	source: "scans" | "citations" | "competitors" | "domain_locales" | "locales" | "fixes";
	/** Column name in the source table (snake_case). */
	sourceColumn: string;
	/** Optional aggregation for METRIC fields. Looker ignores for dims. */
	aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
	/** Whether this field is exposed by default (vs opt-in via `fields`). */
	defaultOn?: boolean;
}

// ── Dimensions ──────────────────────────────────────────────

export const DIMENSIONS: LookerFieldSpec[] = [
	{
		id: "scan_id",
		name: "Scan ID",
		descriptionDe: "Eindeutige ID des Scans",
		kind: "DIMENSION",
		dataType: "STRING",
		source: "scans",
		sourceColumn: "id",
	},
	{
		id: "domain",
		name: "Domain",
		descriptionDe: "Gescannte Domain (normalisierte URL-Host)",
		kind: "DIMENSION",
		dataType: "STRING",
		source: "scans",
		sourceColumn: "url",
		defaultOn: true,
	},
	{
		id: "scan_date",
		name: "Scan Date",
		descriptionDe: "Datum des Scans (YYYYMMDD für Looker)",
		kind: "DIMENSION",
		dataType: "DATE",
		source: "scans",
		sourceColumn: "scanned_at",
		defaultOn: true,
	},
	{
		id: "locale_country",
		name: "Locale Country",
		descriptionDe: "ISO-3166 Land des Locale-Scans (z.B. DE, US)",
		kind: "DIMENSION",
		dataType: "STRING",
		source: "locales",
		sourceColumn: "country_code",
	},
	{
		id: "locale_language",
		name: "Locale Language",
		descriptionDe: "ISO-639 Sprache des Locale-Scans (z.B. de, en)",
		kind: "DIMENSION",
		dataType: "STRING",
		source: "locales",
		sourceColumn: "language_code",
	},
	{
		id: "competitor_domain",
		name: "Competitor Domain",
		descriptionDe: "Domain eines getrackten Wettbewerbers",
		kind: "DIMENSION",
		dataType: "STRING",
		source: "competitors",
		sourceColumn: "domain",
	},
	{
		id: "status",
		name: "Scan Status",
		descriptionDe: "pending / processing / completed / failed",
		kind: "DIMENSION",
		dataType: "STRING",
		source: "scans",
		sourceColumn: "status",
	},
];

// ── Metrics ─────────────────────────────────────────────────

export const METRICS: LookerFieldSpec[] = [
	{
		id: "readiness_score",
		name: "AI Readiness Score",
		descriptionDe: "Gesamtscore der AI-Readiness (0-100)",
		kind: "METRIC",
		dataType: "NUMBER",
		source: "scans",
		sourceColumn: "score",
		aggregation: "AVG",
		defaultOn: true,
	},
	{
		id: "readiness_level",
		name: "Readiness Level",
		descriptionDe: "Stufe 1-3 basierend auf Score",
		kind: "METRIC",
		dataType: "NUMBER",
		source: "scans",
		sourceColumn: "readiness_level",
		aggregation: "AVG",
	},
	{
		id: "citation_count",
		name: "Citation Count",
		descriptionDe: "Anzahl AI-Zitierungen für diesen Scan",
		kind: "METRIC",
		dataType: "NUMBER",
		source: "citations",
		sourceColumn: "audit_id",
		aggregation: "COUNT",
		defaultOn: true,
	},
	{
		id: "fix_count",
		name: "Fix Count",
		descriptionDe: "Anzahl generierter Fixes für diesen Scan",
		kind: "METRIC",
		dataType: "NUMBER",
		source: "fixes",
		sourceColumn: "scan_id",
		aggregation: "COUNT",
	},
	{
		id: "competitor_count",
		name: "Competitor Count",
		descriptionDe: "Anzahl getrackter Wettbewerber",
		kind: "METRIC",
		dataType: "NUMBER",
		source: "competitors",
		sourceColumn: "id",
		aggregation: "COUNT",
	},
	{
		id: "locale_count",
		name: "Locale Count",
		descriptionDe: "Anzahl konfigurierter Locales pro Domain",
		kind: "METRIC",
		dataType: "NUMBER",
		source: "domain_locales",
		sourceColumn: "locale_id",
		aggregation: "COUNT",
	},
];

export const LOOKER_FIELDS: LookerFieldSpec[] = [...DIMENSIONS, ...METRICS];

export const LOOKER_FIELD_IDS = LOOKER_FIELDS.map((f) => f.id);

/** Returns the field ids exposed by default when the caller omits `fields`. */
export function getDefaultFieldIds(): string[] {
	return LOOKER_FIELDS.filter((f) => f.defaultOn).map((f) => f.id);
}

/** Looks a field up by id. Throws when the id is unknown. */
export function getFieldById(id: string): LookerFieldSpec {
	const field = LOOKER_FIELDS.find((f) => f.id === id);
	if (!field) throw new Error(`Unknown Looker field id: ${id}`);
	return field;
}

/** Validates a caller-supplied list of field ids. Returns the set of unknown ids. */
export function validateFieldIds(ids: string[]): string[] {
	const known = new Set(LOOKER_FIELD_IDS);
	return ids.filter((id) => !known.has(id));
}

// ── Response row type ───────────────────────────────────────

/**
 * Looker Studio expects `getData()` to return rows shaped as:
 *   { values: [v1, v2, ...] } with the array ordered by the requested field ids.
 * This helper builds such a row from a free-form source record.
 */
export interface LookerRow {
	values: Array<string | number | boolean | null>;
}

/**
 * Formats a Date as Looker's YYYYMMDD integer representation.
 * Returns null for invalid/missing dates (Looker treats null as no value).
 */
export function formatLookerDate(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return null;
	const y = d.getUTCFullYear().toString().padStart(4, "0");
	const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
	const dd = d.getUTCDate().toString().padStart(2, "0");
	return `${y}${m}${dd}`;
}
