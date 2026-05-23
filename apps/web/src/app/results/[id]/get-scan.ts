import type { AccessMode } from "@/lib/scan-access";
import { normalizeAccessToken } from "@/lib/scan-access";
import type { ScanResponse } from "@/types/scan-api";
import { db, scanQueries } from "@beacon/db";
import type { LevelScores, ScanCheck } from "@beacon/shared";
import { UuidSchema } from "@beacon/shared";
import { cache } from "react";

type ScanStatusRow = NonNullable<Awaited<ReturnType<typeof scanQueries.getStatusById>>>;

export function serializeScan(scan: ScanStatusRow, accessMode: AccessMode): ScanResponse {
	const id = scan.id;
	const url = scan.url;
	const scannedAt = scan.scannedAt.toISOString();

	if (scan.status === "completed") {
		return {
			id,
			url,
			scannedAt,
			status: "completed" as const,
			finalUrl: scan.finalUrl ?? null,
			score: scan.score ?? 0,
			readinessLevel: scan.readinessLevel ?? 0,
			levelScores: (scan.levelScores ?? {
				readability: null,
				interactivity: null,
				transactional: null,
			}) as LevelScores,
			checks: (scan.checks ?? []) as ScanCheck[],
			fixes:
				accessMode === "owner"
					? ((scan.fixes as Record<
							string,
							{ checkId: string; content: string; filename: string; method: string }
						>) ?? null)
					: null,
			processingDurationMs: scan.processingDurationMs ?? null,
			completedAt: scan.updatedAt?.toISOString() ?? null,
			actions:
				accessMode === "owner"
					? {
							analysis: `/api/scan/${scan.id}/analysis`,
							detail: `/api/scan/${scan.id}/detail`,
							fix: "/api/fix",
						}
					: null,
		};
	}

	if (scan.status === "failed") {
		return {
			id,
			url,
			scannedAt,
			status: "failed" as const,
			error: scan.errorMessage ?? "Unbekannter Fehler",
		};
	}

	if (scan.status === "processing") {
		return { id, url, scannedAt, status: "processing" as const };
	}

	return { id, url, scannedAt, status: "pending" as const };
}

export const getScan = cache(
	async (
		id: string,
		accessToken?: string | string[],
	): Promise<{ scan: ScanResponse; accessMode: AccessMode } | null> => {
		const token = normalizeAccessToken(accessToken);
		const parseResult = UuidSchema.safeParse(id);
		if (!parseResult.success) return null;

		const scan = await scanQueries.getStatusById(db, parseResult.data);
		if (!scan) return null;

		// OSS build: no auth; only the access token mints "owner" access.
		const { getScanAccess } = await import("@/lib/scan-access");
		const accessMode = getScanAccess(scan, { viewerUserId: null, accessToken: token });
		if (!accessMode) return null;

		return { scan: serializeScan(scan, accessMode), accessMode };
	},
);
