import { csvExportQueries, db } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
	const { id } = await params;
	const check = UuidSchema.safeParse(id);
	if (!check.success) {
		return NextResponse.json({ error: "Ungültige Export-ID." }, { status: 400 });
	}

	const exp = await csvExportQueries.getById(db, id);
	if (!exp) {
		return NextResponse.json({ error: "Export nicht gefunden." }, { status: 404 });
	}

	const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
	return NextResponse.json({
		id: exp.id,
		entity: exp.entity,
		status: exp.status,
		progress: exp.progress,
		rowCount: exp.rowCount,
		fileBytes: exp.fileBytes,
		errorMessage: exp.errorMessage,
		startedAt: exp.startedAt?.toISOString() ?? null,
		completedAt: exp.completedAt?.toISOString() ?? null,
		downloadUrl: exp.downloadUrl,
		urlExpiresAt: exp.urlExpiresAt?.toISOString() ?? null,
		// Convenience: an alternative streaming-download path served by
		// the web container if the operator wants to keep files local.
		streamDownloadUrl:
			exp.status === "completed" ? `${origin}/api/csv-export/${exp.id}/download` : null,
	});
}
