import { assertBearerAuth } from "@/lib/api-token";
import { aiVisibilityQueries, db } from "@beacon/db";
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
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const url = new URL(request.url);
	const limit = Math.min(
		Math.max(Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1),
		500,
	);

	const snapshots = await aiVisibilityQueries.getSnapshotsByProjectId(db, id, { limit });
	return NextResponse.json({
		snapshots: snapshots.map((s) => ({
			id: s.id,
			projectId: s.projectId,
			brandName: s.brandName,
			aiEngine: s.aiEngine,
			queryText: s.queryText,
			queriedAt: s.queriedAt.toISOString(),
			costCents: s.costCents,
		})),
	});
}
