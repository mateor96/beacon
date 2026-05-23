/**
 * Deployment status state machine (#291).
 *
 * Defines valid status transitions for deployment attempts.
 * Pure functions — no DB, no side effects.
 *
 * Valid transitions:
 *   pending     → in_progress, failed
 *   in_progress → succeeded, failed
 *   succeeded   → rolled_back, failed (rollback failure)
 *   failed      → (terminal)
 *   rolled_back → (terminal)
 */

export type DeploymentStatus = "pending" | "in_progress" | "succeeded" | "failed" | "rolled_back";

export const VALID_DEPLOYMENT_TRANSITIONS: Record<DeploymentStatus, readonly DeploymentStatus[]> = {
	pending: ["in_progress", "failed"],
	in_progress: ["succeeded", "failed"],
	succeeded: ["rolled_back", "failed"],
	failed: [],
	rolled_back: [],
};

/**
 * Check if a status transition is valid.
 */
export function isValidDeploymentTransition(from: DeploymentStatus, to: DeploymentStatus): boolean {
	return (VALID_DEPLOYMENT_TRANSITIONS[from] as readonly string[]).includes(to);
}

/**
 * Assert a status transition is valid. Throws if not.
 */
export function assertValidDeploymentTransition(
	from: DeploymentStatus,
	to: DeploymentStatus,
): void {
	if (!isValidDeploymentTransition(from, to)) {
		throw new Error(
			`Ungültiger Status-Uebergang: ${from} → ${to}. Erlaubt: ${VALID_DEPLOYMENT_TRANSITIONS[from].join(", ") || "(terminal)"}`,
		);
	}
}

/**
 * Check if a deployment status is terminal (no further transitions possible).
 */
export function isTerminalDeploymentStatus(status: DeploymentStatus): boolean {
	return VALID_DEPLOYMENT_TRANSITIONS[status].length === 0;
}
