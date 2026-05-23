/**
 * Unified API response envelope + query-parameter helpers (#261).
 *
 * Shipped as pure utilities so both the backend routes (apps/web) and
 * the public SDK consumers can share a single contract.
 */

// ── Envelope types ──────────────────────────────────────────

export interface PaginationMeta {
	cursor: string | null;
	hasMore: boolean;
	/** Optional total count — routes may omit for expensive queries. */
	total?: number;
	nextCursor: string | null;
}

export interface Links {
	self: string;
	next: string | null;
}

export interface ListEnvelope<T> {
	data: T[];
	meta: PaginationMeta;
	links?: Links;
}

export interface ItemEnvelope<T> {
	data: T;
	meta: Record<string, unknown>;
}

// ── Query parameter parsing ────────────────────────────────

export interface ParseListQueryOptions {
	/** Hard limit ceiling (defaults to 100). */
	maxLimit?: number;
	/** Default limit when omitted (defaults to 20). */
	defaultLimit?: number;
	/** Allowed field ids for `fields=` selection. */
	allowedFields?: readonly string[];
	/** Allowed sort fields (without direction prefix). */
	allowedSortFields?: readonly string[];
}

export interface ParsedListQuery {
	cursor: string | null;
	limit: number;
	fields: string[] | null;
	sort: { field: string; direction: "asc" | "desc" } | null;
	filters: Record<string, string>;
}

export class QueryParseError extends Error {
	constructor(
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "QueryParseError";
	}
}

const RESERVED_PARAMS = new Set(["cursor", "limit", "fields", "sort"]);

/**
 * Parses the standard list-query parameters from a URLSearchParams.
 * Anything not reserved is returned as a filter (for caller-specific
 * validation). Throws QueryParseError with a machine-readable code on
 * invalid input.
 */
export function parseListQuery(
	params: URLSearchParams,
	opts: ParseListQueryOptions = {},
): ParsedListQuery {
	const { maxLimit = 100, defaultLimit = 20, allowedFields, allowedSortFields } = opts;

	const cursor = params.get("cursor");

	let limit = defaultLimit;
	const limitRaw = params.get("limit");
	if (limitRaw !== null) {
		const n = Number.parseInt(limitRaw, 10);
		if (!Number.isFinite(n) || n < 1) {
			throw new QueryParseError("INVALID_LIMIT", "limit muss >= 1 sein.");
		}
		limit = Math.min(maxLimit, n);
	}

	let fields: string[] | null = null;
	const fieldsRaw = params.get("fields");
	if (fieldsRaw !== null && fieldsRaw.trim().length > 0) {
		fields = fieldsRaw
			.split(",")
			.map((f) => f.trim())
			.filter(Boolean);
		if (allowedFields) {
			const allowedSet = new Set(allowedFields);
			const unknown = fields.filter((f) => !allowedSet.has(f));
			if (unknown.length > 0) {
				throw new QueryParseError("INVALID_FIELDS", `Unbekannte Felder: ${unknown.join(", ")}`);
			}
		}
	}

	let sort: ParsedListQuery["sort"] = null;
	const sortRaw = params.get("sort");
	if (sortRaw !== null && sortRaw.length > 0) {
		const direction: "asc" | "desc" = sortRaw.startsWith("-") ? "desc" : "asc";
		const field = sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw;
		if (allowedSortFields && !allowedSortFields.includes(field)) {
			throw new QueryParseError("INVALID_SORT", `Sort-Feld nicht erlaubt: ${field}`);
		}
		sort = { field, direction };
	}

	const filters: Record<string, string> = {};
	params.forEach((value, key) => {
		if (!RESERVED_PARAMS.has(key)) filters[key] = value;
	});

	return { cursor, limit, fields, sort, filters };
}

// ── Envelope builders ──────────────────────────────────────

export interface BuildListEnvelopeOpts<T> {
	items: T[];
	limit: number;
	/** Opaque cursor for the next page, or null when exhausted. */
	nextCursor: string | null;
	/** Optional total count. */
	total?: number;
	/** Current request URL (for self/next links). */
	requestUrl?: string | null;
}

export function buildListEnvelope<T>(opts: BuildListEnvelopeOpts<T>): ListEnvelope<T> {
	const envelope: ListEnvelope<T> = {
		data: opts.items,
		meta: {
			cursor: opts.nextCursor,
			nextCursor: opts.nextCursor,
			hasMore: opts.nextCursor !== null,
			...(typeof opts.total === "number" ? { total: opts.total } : {}),
		},
	};

	if (opts.requestUrl) {
		const self = opts.requestUrl;
		const next = (() => {
			if (!opts.nextCursor) return null;
			try {
				const u = new URL(self);
				u.searchParams.set("cursor", opts.nextCursor);
				return u.toString();
			} catch {
				return null;
			}
		})();
		envelope.links = { self, next };
	}

	return envelope;
}

export function buildItemEnvelope<T>(data: T, meta: Record<string, unknown> = {}): ItemEnvelope<T> {
	return { data, meta };
}

/** Projects a record down to the caller-requested field set. */
export function projectFields<T extends Record<string, unknown>>(
	item: T,
	fields: string[] | null,
): Partial<T> {
	if (!fields) return item;
	const out: Partial<T> = {};
	for (const f of fields) {
		if (f in item) (out as Record<string, unknown>)[f] = item[f];
	}
	return out;
}
