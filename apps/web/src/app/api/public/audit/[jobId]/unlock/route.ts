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
		const rateLimitResult = await checkRateLimit(`public-audit-unlock:${hashIp(ip)}`, {
			maxRequests: 10,
			windowMs: 60_000,
		});
		if (!rateLimitResult.allowed) {
			return createRateLimitResponse(rateLimitResult);
		}

		// 4. Validate jobId
		const { jobId } = await params;
		const { UuidSchema, UnlockRequestSchema } = await import("@beacon/shared");
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

		const parseResult = UnlockRequestSchema.safeParse(body);
		if (!parseResult.success) {
			const firstError = parseResult.error.issues[0]?.message ?? "Ungültige Eingabe";
			return NextResponse.json({ error: firstError }, { status: 400 });
		}
		const { email, companyName, utmSource, utmMedium, utmCampaign } = parseResult.data;

		// 6. Verify request exists and is completed
		const { db, publicAuditQueries } = await import("@beacon/db");
		const auditRequest = await publicAuditQueries.getRequestById(db, idResult.data);
		if (!auditRequest) {
			return NextResponse.json({ error: "Audit nicht gefunden" }, { status: 404 });
		}
		if (auditRequest.status !== "completed") {
			return NextResponse.json({ error: "Audit ist noch nicht abgeschlossen" }, { status: 400 });
		}

		// 7. Create lead (ignore if already exists for this request)
		await publicAuditQueries.createLeadOrIgnore(db, {
			requestId: jobId,
			email,
			companyName: companyName ?? null,
			utmSource: utmSource ?? null,
			utmMedium: utmMedium ?? null,
			utmCampaign: utmCampaign ?? null,
		});

		// 8. Fire-and-forget conversion event
		publicAuditQueries
			.createConversionEvent(db, {
				requestId: jobId,
				eventType: "email_entered",
			})
			.catch((err) => {
				console.error(
					"[POST /api/public/audit/[jobId]/unlock] Failed to create conversion event:",
					err,
				);
			});

		// TODO: Enqueue drip email (audit-report-ready template) via addJob("email", { ... })

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error("[POST /api/public/audit/[jobId]/unlock] Unhandled error:", error);
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
			{ status: 500 },
		);
	}
}
