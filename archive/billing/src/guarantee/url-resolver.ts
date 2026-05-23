import type { DbClient } from "@beacon/db";
import { monitoringProjects, scans } from "@beacon/db";
import { desc, eq } from "drizzle-orm";

/**
 * Resolve the URL to use for a guarantee baseline scan.
 *
 * Fallback order:
 *  1. `baselineUrl` passed through Stripe checkout metadata (most specific)
 *  2. The user's latest monitoring project website (intentional setup)
 *  3. The user's most recent scan URL (last-known-good signal)
 *  4. null → caller defers baseline creation and logs an audit entry
 */
export async function resolveBaselineUrl(
	tx: DbClient,
	userId: string,
	metadataUrl: string | null | undefined,
): Promise<string | null> {
	const trimmedMeta = metadataUrl?.trim();
	if (trimmedMeta) return trimmedMeta;

	const project = await tx
		.select({ websiteUrl: monitoringProjects.websiteUrl })
		.from(monitoringProjects)
		.where(eq(monitoringProjects.userId, userId))
		.orderBy(desc(monitoringProjects.createdAt))
		.limit(1)
		.then((rows) => rows[0]);
	if (project?.websiteUrl) return project.websiteUrl;

	const latestScan = await tx
		.select({ url: scans.url })
		.from(scans)
		.where(eq(scans.userId, userId))
		.orderBy(desc(scans.scannedAt))
		.limit(1)
		.then((rows) => rows[0]);
	if (latestScan?.url) return latestScan.url;

	return null;
}
