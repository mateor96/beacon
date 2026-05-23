import { assertBearerAuth } from "@/lib/api-token";
import { db, scanQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
	const auth = assertBearerAuth(request);
	if (auth) return auth;

	const { id } = await params;
	const check = UuidSchema.safeParse(id);
	if (!check.success) {
		return NextResponse.json({ error: "Ungültige Scan-ID." }, { status: 400 });
	}

	const scan = await scanQueries.getById(db, id);
	if (!scan) {
		return NextResponse.json({ error: "Scan nicht gefunden." }, { status: 404 });
	}

	return NextResponse.json({
		id: scan.id,
		url: scan.url,
		finalUrl: scan.finalUrl,
		status: scan.status,
		score: scan.score,
		readinessLevel: scan.readinessLevel,
		levelScores: scan.levelScores,
		checks: scan.checks,
		scannedAt: scan.scannedAt.toISOString(),
		completedAt: scan.updatedAt?.toISOString() ?? null,
	});
}
