/**
 * Stale deployment reaper (#291).
 *
 * Finds deployments stuck in pending/in_progress for longer than the
 * configured timeout and marks them as failed with TIMEOUT error code.
 */

const STALE_THRESHOLD_MS = Number(process.env.DEPLOYMENT_TIMEOUT_MS) || 30 * 60 * 1000; // 30 min

export async function reapStaleDeployments(): Promise<{ reaped: number }> {
	const { db, fixQueries } = await import("@beacon/db");

	const activeDeployments = await fixQueries.listActiveDeployments(db);
	const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
	let reaped = 0;

	for (const deployment of activeDeployments) {
		if (deployment.startedAt && deployment.startedAt < cutoff) {
			await fixQueries.updateDeploymentStatus(db, deployment.id, {
				status: "failed",
				errorMessage: `Deployment timed out after ${Math.round(STALE_THRESHOLD_MS / 60_000)} minutes`,
				errorCode: "TIMEOUT",
				completedAt: new Date(),
			});
			reaped++;
		}
	}

	return { reaped };
}
