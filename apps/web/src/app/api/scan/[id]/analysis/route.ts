import { checkRateLimit } from "@/lib/rate-limit";
import { getScanAccess, normalizeAccessToken } from "@/lib/scan-access";
import { db, scanQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { type NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_CONFIG = { maxRequests: 60, windowMs: 60_000 };

function parseAnalysisJson(raw: string | null): unknown | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

type AnalysisStatus = string | null;

function deriveOverallStatus(
	semantic: AnalysisStatus,
	citation: AnalysisStatus,
): "pending" | "processing" | "complete" | "failed" {
	// Only consider types that have actually been started (non-null)
	const active = [semantic, citation].filter((s) => s != null);
	if (active.length === 0) return "pending";

	const allTerminal = active.every((s) => s === "completed" || s === "failed");
	const allCompleted = active.every((s) => s === "completed");
	const anyFailed = active.some((s) => s === "failed");

	if (allCompleted) return "complete";
	if (allTerminal && anyFailed) return "failed";
	return "processing";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
		const rateLimitResult = await checkRateLimit(`analysis-status:${ip}`, RATE_LIMIT_CONFIG);
		if (!rateLimitResult.allowed) {
			return NextResponse.json(
				{ error: "Zu viele Anfragen. Bitte versuche es später erneut." },
				{
					status: 429,
					headers: {
						"Retry-After": String(
							Math.max(1, Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
						),
					},
				},
			);
		}

		const { id } = await params;
		const parseResult = UuidSchema.safeParse(id);
		if (!parseResult.success) {
			return NextResponse.json({ error: "Ungültige Scan-ID" }, { status: 400 });
		}

		const url = new URL(request.url);
		const accessValues = url.searchParams.getAll("access");
		const accessToken = normalizeAccessToken(
			accessValues.length === 1 ? accessValues[0] : accessValues,
		);

		const fullScan = await scanQueries.getStatusById(db, parseResult.data);
		if (!fullScan) {
			return NextResponse.json({ error: "Scan nicht gefunden" }, { status: 404 });
		}

		// Access-token-gated read — only the owner of the scan id can read analysis.
		const accessMode = getScanAccess(fullScan, { viewerUserId: null, accessToken });
		if (accessMode !== "owner") {
			return NextResponse.json({ error: "Scan nicht gefunden" }, { status: 404 });
		}

		const scan = await scanQueries.getAnalysisById(db, parseResult.data);
		if (!scan) {
			return NextResponse.json({ error: "Scan nicht gefunden" }, { status: 404 });
		}

		const status = deriveOverallStatus(scan.aiAnalysisStatus, scan.citationAnalysisStatus);

		const response = {
			scanId: scan.id,
			url: scan.url,
			status,
			semantic:
				scan.aiAnalysisStatus === "completed"
					? { status: "completed" as const, data: parseAnalysisJson(scan.aiAnalysis) }
					: scan.aiAnalysisStatus
						? { status: scan.aiAnalysisStatus, error: scan.aiAnalysisError ?? undefined }
						: null,
			citation:
				scan.citationAnalysisStatus === "completed"
					? { status: "completed" as const, data: parseAnalysisJson(scan.citationAiAnalysis) }
					: scan.citationAnalysisStatus
						? {
								status: scan.citationAnalysisStatus,
								error: scan.citationAnalysisError ?? undefined,
							}
						: null,
		};

		return NextResponse.json(response, {
			headers: { "Cache-Control": "private, no-store" },
		});
	} catch (_error) {
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
			{ status: 500 },
		);
	}
}
