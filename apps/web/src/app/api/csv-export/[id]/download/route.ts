import { readFile } from "node:fs/promises";
import path from "node:path";
import { csvExportQueries, db } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

/**
 * Streaming-download fallback when the worker wrote to local filesystem.
 * Reads the file from CSV_EXPORT_LOCAL_DIR + storageKey and serves it
 * with appropriate Content-Disposition. For S3/R2 deployments, prefer
 * the `downloadUrl` from GET /api/csv-export/[id] (signed URL).
 */
export async function GET(_request: Request, { params }: RouteContext) {
	const { id } = await params;
	const check = UuidSchema.safeParse(id);
	if (!check.success) {
		return NextResponse.json({ error: "Ungültige Export-ID." }, { status: 400 });
	}

	const exp = await csvExportQueries.getById(db, id);
	if (!exp) {
		return NextResponse.json({ error: "Export nicht gefunden." }, { status: 404 });
	}
	if (exp.status !== "completed" || !exp.storageKey) {
		return NextResponse.json({ error: "Export ist noch nicht fertig." }, { status: 409 });
	}

	const rootDir = process.env.CSV_EXPORT_LOCAL_DIR ?? "/tmp/beacon-csv-exports";
	const filePath = path.join(rootDir, exp.storageKey);
	const normalisedRoot = path.resolve(rootDir);
	const normalisedFile = path.resolve(filePath);
	if (!normalisedFile.startsWith(normalisedRoot + path.sep)) {
		return NextResponse.json({ error: "Pfad nicht erlaubt." }, { status: 400 });
	}

	let bytes: Buffer;
	try {
		bytes = await readFile(filePath);
	} catch {
		return NextResponse.json(
			{
				error:
					"Datei nicht lesbar. Möglicherweise wurde sie bereinigt oder mit einem anderen Storage-Adapter geschrieben.",
			},
			{ status: 404 },
		);
	}

	return new NextResponse(bytes as unknown as BodyInit, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="beacon-${exp.entity}-${exp.id}.csv"`,
			"Content-Length": String(bytes.byteLength),
		},
	});
}
