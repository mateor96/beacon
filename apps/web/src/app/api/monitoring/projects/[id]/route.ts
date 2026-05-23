import { hashIp } from "@/lib/hash-ip";
import { checkRateLimit, createRateLimitResponse, getRateLimitConfig } from "@/lib/rate-limit";
import { aiVisibilityQueries, db, monitoringQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { id } = await params;
	const idCheck = UuidSchema.safeParse(id);
	if (!idCheck.success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const project = await monitoringQueries.getProjectById(db, id);
	if (!project) {
		return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
	}

	// Recent snapshots — most callers want a "latest activity" view.
	const snapshots = await aiVisibilityQueries.getSnapshotsByProjectId(db, id, { limit: 10 });

	return NextResponse.json({
		id: project.id,
		name: project.name,
		websiteUrl: project.websiteUrl,
		brandKeywords: project.brandKeywords,
		competitorKeywords: project.competitorKeywords ?? [],
		createdAt: project.createdAt?.toISOString() ?? null,
		updatedAt: project.updatedAt?.toISOString() ?? null,
		snapshots: snapshots.map((s) => ({
			id: s.id,
			brandName: s.brandName,
			aiEngine: s.aiEngine,
			queryText: s.queryText,
			queriedAt: s.queriedAt.toISOString(),
			costCents: s.costCents,
		})),
	});
}

export async function DELETE(request: Request, { params }: RouteContext) {
	const { id } = await params;
	const idCheck = UuidSchema.safeParse(id);
	if (!idCheck.success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`monitoring-delete:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const deleted = await monitoringQueries.softDeleteProject(db, id);
	if (!deleted) {
		return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
	}

	return NextResponse.json({ id: deleted.id, deletedAt: deleted.deletedAt?.toISOString() });
}
