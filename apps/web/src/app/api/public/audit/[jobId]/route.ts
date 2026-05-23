import { type NextRequest, NextResponse } from "next/server";

import { hashIp } from "@/lib/hash-ip";
import { checkRateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_CONFIG = { maxRequests: 60, windowMs: 60_000 };

const SECURITY_HEADERS = {
	"X-Robots-Tag": "noindex",
	"X-Content-Type-Options": "nosniff",
};

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ jobId: string }> },
) {
	try {
		// 1. Rate limit
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
		const rateLimitResult = await checkRateLimit(
			`public-audit-status:${hashIp(ip)}`,
			RATE_LIMIT_CONFIG,
		);
		if (!rateLimitResult.allowed) {
			return NextResponse.json(
				{ error: "Zu viele Anfragen. Bitte versuche es später erneut." },
				{
					status: 429,
					headers: {
						...SECURITY_HEADERS,
						"Cache-Control": "no-store",
						"Retry-After": String(
							Math.max(1, Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
						),
					},
				},
			);
		}

		// 2. Validate jobId
		const { jobId } = await params;
		const { UuidSchema } = await import("@beacon/shared");
		const parseResult = UuidSchema.safeParse(jobId);
		if (!parseResult.success) {
			return NextResponse.json(
				{ error: "Ungültige Audit-ID" },
				{ status: 400, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store" } },
			);
		}

		// 3. Fetch request
		const { db, publicAuditQueries } = await import("@beacon/db");
		const auditRequest = await publicAuditQueries.getRequestById(db, parseResult.data);
		if (!auditRequest) {
			return NextResponse.json(
				{ error: "Audit nicht gefunden" },
				{ status: 404, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store" } },
			);
		}

		// 4. Build response
		const response: Record<string, unknown> = {
			jobId: auditRequest.id,
			status: auditRequest.status,
			url: auditRequest.url,
			createdAt: auditRequest.createdAt,
		};

		// 5. If completed, fetch result
		if (auditRequest.status === "completed") {
			const result = await publicAuditQueries.getResultByRequestId(db, auditRequest.id);
			if (result) {
				response.result = {
					overallScore: result.overallScore,
					modelScores: result.modelScores,
					summary: result.summary,
				};
			}
		}

		// 6. Cache headers based on status
		const cacheControl = auditRequest.status === "completed" ? "public, max-age=3600" : "no-store";

		return NextResponse.json(response, {
			headers: {
				...SECURITY_HEADERS,
				"Cache-Control": cacheControl,
			},
		});
	} catch (error) {
		console.error("[GET /api/public/audit/[jobId]] Unhandled error:", error);
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
			{ status: 500, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store" } },
		);
	}
}
