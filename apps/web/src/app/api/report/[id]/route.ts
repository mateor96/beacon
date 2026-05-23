import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { checkRateLimit } from "@/lib/rate-limit";
import { getScanAccess, normalizeAccessToken } from "@/lib/scan-access";
import { db, scanQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { type NextRequest, NextResponse } from "next/server";

const REPORT_STORAGE_PATH = process.env.REPORT_STORAGE_PATH ?? "/tmp/reports";
const RATE_LIMIT_CONFIG = { maxRequests: 30, windowMs: 60_000 };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
		const rateLimitResult = await checkRateLimit(`report-download:${ip}`, RATE_LIMIT_CONFIG);
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
		const scanId = parseResult.data;

		const url = new URL(request.url);
		const accessValues = url.searchParams.getAll("access");
		const accessToken = normalizeAccessToken(
			accessValues.length === 1 ? accessValues[0] : accessValues,
		);

		const scan = await scanQueries.getById(db, scanId);
		if (!scan) {
			return NextResponse.json({ error: "Scan nicht gefunden" }, { status: 404 });
		}

		const accessMode = getScanAccess(scan, { viewerUserId: null, accessToken });
		if (accessMode !== "owner") {
			return NextResponse.json({ error: "Scan nicht gefunden" }, { status: 404 });
		}

		if (scan.expiresAt && scan.expiresAt < new Date()) {
			return NextResponse.json({ error: "Dieser Scan ist abgelaufen." }, { status: 410 });
		}

		if (scan.status !== "completed") {
			return NextResponse.json(
				{ error: "Der Scan ist noch nicht abgeschlossen." },
				{ status: 409 },
			);
		}

		if (!scan.reportGeneratedAt) {
			return NextResponse.json(
				{ error: "Kein Report vorhanden. Bitte zuerst einen Report generieren." },
				{ status: 404 },
			);
		}

		const pdfPath = path.resolve(REPORT_STORAGE_PATH, `${scanId}.pdf`);
		if (!pdfPath.startsWith(path.resolve(REPORT_STORAGE_PATH))) {
			return NextResponse.json({ error: "Ungültige Scan-ID" }, { status: 400 });
		}

		try {
			await stat(pdfPath);
		} catch {
			return NextResponse.json({ error: "PDF-Datei nicht gefunden." }, { status: 404 });
		}

		const pdfBuffer = await readFile(pdfPath);
		const filename = `beacon-report-${scanId}.pdf`;

		return new Response(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Content-Length": String(pdfBuffer.length),
				"Cache-Control": "private, max-age=3600",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (_error) {
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
			{ status: 500 },
		);
	}
}
