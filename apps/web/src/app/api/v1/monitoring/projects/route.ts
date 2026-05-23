import { assertBearerAuth } from "@/lib/api-token";
import { db, monitoringQueries } from "@beacon/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const auth = assertBearerAuth(request);
	if (auth) return auth;

	const projects = await monitoringQueries.listAllProjects(db);
	return NextResponse.json({
		projects: projects.map((p) => ({
			id: p.id,
			name: p.name,
			websiteUrl: p.websiteUrl,
			brandKeywords: p.brandKeywords,
			competitorKeywords: p.competitorKeywords ?? [],
			createdAt: p.createdAt?.toISOString() ?? null,
		})),
	});
}
