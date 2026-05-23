import { assertBearerAuth } from "@/lib/api-token";
import { db, scans } from "@beacon/db";
import { and, asc, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = new Set([
	"scan_id",
	"domain",
	"scan_date",
	"locale_country",
	"locale_language",
	"competitor_domain",
	"status",
	"readiness_score",
	"readiness_level",
	"citation_count",
	"fix_count",
	"competitor_count",
	"locale_count",
]);

function safeDomain(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

interface Row {
	[field: string]: string | number | null;
}

function projectRow(scan: typeof scans.$inferSelect, fields: string[]): Row {
	const out: Row = {};
	const fixesObj =
		scan.fixes && typeof scan.fixes === "object" && !Array.isArray(scan.fixes)
			? (scan.fixes as Record<string, unknown>)
			: {};
	for (const f of fields) {
		switch (f) {
			case "scan_id":
				out[f] = scan.id;
				break;
			case "domain":
				out[f] = safeDomain(scan.finalUrl ?? scan.url);
				break;
			case "scan_date":
				// Looker DATE format: YYYYMMDD
				out[f] = scan.scannedAt.toISOString().slice(0, 10).replace(/-/g, "");
				break;
			case "status":
				out[f] = scan.status;
				break;
			case "readiness_score":
				out[f] = scan.score;
				break;
			case "readiness_level":
				out[f] = scan.readinessLevel;
				break;
			case "fix_count":
				out[f] = Object.keys(fixesObj).length;
				break;
			// Joined / aggregated fields not computed in v0.2 — return null
			// so Looker handles them gracefully.
			case "locale_country":
			case "locale_language":
			case "competitor_domain":
				out[f] = null;
				break;
			case "citation_count":
			case "competitor_count":
			case "locale_count":
				out[f] = 0;
				break;
		}
	}
	return out;
}

export async function GET(request: Request) {
	const auth = assertBearerAuth(request);
	if (auth) return auth;

	const url = new URL(request.url);
	const fieldsParam = url.searchParams.get("fields") ?? "";
	const requested = fieldsParam
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0 && ALLOWED_FIELDS.has(s));

	if (requested.length === 0) {
		return NextResponse.json(
			{ error: "fields=<comma-separated> erforderlich (Looker-Connector ist die übliche Quelle)." },
			{ status: 400 },
		);
	}

	const fromStr = url.searchParams.get("from");
	const toStr = url.searchParams.get("to");
	const pageSize = Math.min(
		Math.max(Number.parseInt(url.searchParams.get("pageSize") ?? "1000", 10) || 1000, 1),
		1000,
	);
	const cursor = url.searchParams.get("cursor"); // ISO timestamp of last seen scan

	const conds = [] as Parameters<typeof and>;
	if (fromStr) conds.push(gte(scans.scannedAt, parseLookerDate(fromStr)));
	if (toStr) conds.push(lte(scans.scannedAt, parseLookerDate(toStr)));
	if (cursor) conds.push(gte(scans.scannedAt, new Date(cursor)));

	const rows = await db
		.select()
		.from(scans)
		.where(conds.length > 0 ? and(...conds) : undefined)
		.orderBy(asc(scans.scannedAt))
		.limit(pageSize + 1);

	const hasMore = rows.length > pageSize;
	const sliced = hasMore ? rows.slice(0, pageSize) : rows;
	const nextCursor = hasMore ? sliced[sliced.length - 1]?.scannedAt.toISOString() : null;

	return NextResponse.json({
		rows: sliced.map((r) => projectRow(r, requested)),
		meta: {
			hasMore,
			nextCursor,
			pageSize,
			returned: sliced.length,
		},
	});
}

function parseLookerDate(input: string): Date {
	// Looker passes YYYY-MM-DD; also accept ISO timestamps.
	if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T00:00:00Z`);
	return new Date(input);
}
