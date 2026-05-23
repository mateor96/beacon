import { checkRateLimit } from "@/lib/rate-limit";
import { getScanAccess, normalizeAccessToken } from "@/lib/scan-access";
import { db, scanQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { type NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_CONFIG = { maxRequests: 60, windowMs: 60_000 };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
		const rateLimitResult = await checkRateLimit(`report-status:${ip}`, RATE_LIMIT_CONFIG);
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

		const scan = await scanQueries.getById(db, parseResult.data);
		if (!scan) {
			return NextResponse.json({ error: "Scan nicht gefunden" }, { status: 404 });
		}

		const accessMode = getScanAccess(scan, { viewerUserId: null, accessToken });
		if (accessMode !== "owner") {
			return NextResponse.json({ error: "Scan nicht gefunden" }, { status: 404 });
		}

		return NextResponse.json(
			{
				scanId: scan.id,
				url: scan.url,
				status: scan.reportStatus ?? null,
				error: scan.reportError ?? null,
				generatedAt: scan.reportGeneratedAt?.toISOString() ?? null,
				fileSizeBytes: scan.reportFileSizeBytes ?? null,
			},
			{ headers: { "Cache-Control": "private, no-store" } },
		);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
			{ status: 500 },
		);
	}
}
