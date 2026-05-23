import { NextResponse } from "next/server";

import { hashIp } from "@/lib/hash-ip";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
	try {
		// 1. Extract IP
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

		// 2. Content-Type guard
		const ctReject = assertJsonContentType(request);
		if (ctReject) return ctReject;

		// 3. Rate limit
		const rateLimitResult = await checkRateLimit(`public-audit-events:${hashIp(ip)}`, {
			maxRequests: 30,
			windowMs: 60_000,
		});
		if (!rateLimitResult.allowed) {
			return createRateLimitResponse(rateLimitResult);
		}

		// 4. Validate jobId
		const { jobId } = await params;
		const { UuidSchema, ConversionEventSchema } = await import("@beacon/shared");
		const idResult = UuidSchema.safeParse(jobId);
		if (!idResult.success) {
			return NextResponse.json({ error: "Ungültige Audit-ID" }, { status: 400 });
		}

		// 5. Parse and validate body
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
		}

		const parseResult = ConversionEventSchema.safeParse(body);
		if (!parseResult.success) {
			const firstError = parseResult.error.issues[0]?.message ?? "Ungültige Eingabe";
			return NextResponse.json({ error: firstError }, { status: 400 });
		}
		const { eventType, metadata } = parseResult.data;

		// 6. Verify request exists
		const { db, publicAuditQueries } = await import("@beacon/db");
		const auditRequest = await publicAuditQueries.getRequestById(db, idResult.data);
		if (!auditRequest) {
			return NextResponse.json({ error: "Audit nicht gefunden" }, { status: 404 });
		}

		// 7. Server-side dedup: if event already exists, return 200
		const existing = await publicAuditQueries.findConversionEvent(db, jobId, eventType);
		if (existing) {
			return NextResponse.json({ ok: true }, { status: 200 });
		}

		// 8. Insert conversion event
		await publicAuditQueries.createConversionEvent(db, {
			requestId: jobId,
			eventType,
			metadata: metadata ?? null,
		});

		return NextResponse.json({ ok: true }, { status: 201 });
	} catch (error) {
		console.error("[POST /api/public/audit/[jobId]/events] Unhandled error:", error);
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
			{ status: 500 },
		);
	}
}
