import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, roiQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string; reportId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
	const { id, reportId } = await params;
	if (!UuidSchema.safeParse(id).success || !UuidSchema.safeParse(reportId).success) {
		return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
	}

	const report = await roiQueries.getRoiReport(db, reportId);
	if (!report || report.projectId !== id) {
		return NextResponse.json({ error: "Report nicht gefunden." }, { status: 404 });
	}

	const url = new URL(request.url);
	const wantsPdf = url.searchParams.get("format") === "pdf";

	if (!wantsPdf) {
		return NextResponse.json({
			id: report.id,
			projectId: report.projectId,
			format: report.format,
			createdAt: report.createdAt.toISOString(),
			reportData: report.reportData,
			downloadUrl: `${url.origin}${url.pathname}?format=pdf`,
		});
	}

	// PDF stream from local report storage. The worker writes
	// roi-report-<id>.pdf into REPORT_STORAGE_PATH.
	const storageRoot = process.env.REPORT_STORAGE_PATH ?? "/tmp/reports";
	const filePath = path.join(storageRoot, `roi-report-${reportId}.pdf`);
	const safeRoot = path.resolve(storageRoot);
	const safePath = path.resolve(filePath);
	if (!safePath.startsWith(safeRoot + path.sep)) {
		return NextResponse.json({ error: "Pfad nicht erlaubt." }, { status: 400 });
	}

	let bytes: Buffer;
	try {
		bytes = await readFile(filePath);
	} catch {
		return NextResponse.json(
			{
				error: "PDF-Datei nicht gefunden. Möglicherweise noch in Bearbeitung — siehe Worker-Logs.",
			},
			{ status: 404 },
		);
	}

	return new NextResponse(bytes as unknown as BodyInit, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="beacon-roi-report-${reportId}.pdf"`,
			"Content-Length": String(bytes.byteLength),
		},
	});
}
