import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";
import { csvExportQueries, db } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CSV_EXPORT_ENTITIES = [
	"scans",
	"citations",
	"competitor_scan_results",
	"domain_locales",
] as const;

const CreateExportSchema = z.object({
	entity: z.enum(CSV_EXPORT_ENTITIES),
	columns: z.array(z.string().max(100)).max(50).optional(),
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
});

export async function GET() {
	const exports = await csvExportQueries.listAll(db);
	return NextResponse.json({
		exports: exports.map((e) => ({
			id: e.id,
			entity: e.entity,
			status: e.status,
			progress: e.progress,
			rowCount: e.rowCount,
			fileBytes: e.fileBytes,
			createdAt: e.createdAt.toISOString(),
			completedAt: e.completedAt?.toISOString() ?? null,
			downloadUrl: e.downloadUrl,
			urlExpiresAt: e.urlExpiresAt?.toISOString() ?? null,
		})),
	});
}

export async function POST(request: Request) {
	const ctReject = assertJsonContentType(request);
	if (ctReject) return ctReject;

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`csv-export:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
	}

	const parsed = CreateExportSchema.safeParse(body);
	if (!parsed.success) {
		const first = parsed.error.issues[0]?.message ?? "Ungültige Eingabe";
		return NextResponse.json({ error: first }, { status: 400 });
	}

	const created = await csvExportQueries.create(db, {
		entity: parsed.data.entity,
		columns: parsed.data.columns ?? null,
		dateFrom: parsed.data.from ? new Date(parsed.data.from) : null,
		dateTo: parsed.data.to ? new Date(parsed.data.to) : null,
		status: "pending",
	});

	await addJob("csv-export", { exportId: created.id });

	const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
	return NextResponse.json(
		{
			exportId: created.id,
			status: "pending",
			statusUrl: `${origin}/api/csv-export/${created.id}`,
		},
		{ status: 202, headers: rateLimitHeaders(rate) },
	);
}
