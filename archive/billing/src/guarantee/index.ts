export {
	isGuaranteeEligible,
	checkGuaranteeEligibility,
	type CheckGuaranteeEligibilityParams,
	type CheckGuaranteeEligibilityResult,
} from "./eligibility.js";
export { GUARANTEE_RULE_IDS, isRuleEnabled, type GuaranteeRuleId } from "./rules.js";
export { resolveBaselineUrl } from "./url-resolver.js";
export { GUARANTEE_TERMS_VERSION, GUARANTEE_TERMS_PATH } from "./terms.js";
export {
	GUARANTEE_DAY90_JOB_PREFIX,
	guaranteeDay90JobId,
	runDay90ComparisonCron,
	handleDay90ScanCompletion,
	type Day90CronResult,
} from "./day90.js";
export { runMilestoneEmailsCron, type MilestoneEmailsResult } from "./milestone-emails.js";
export { processGuaranteeRefund, type ProcessRefundResult } from "./refund.js";
export {
	TERMINAL_STATUSES,
	isTerminalStatus,
	cancelGuaranteeForSubscription,
	adminOverrideStatus,
	refundEligibilityGuard,
	type CancelResult,
	type AdminOverrideParams,
	type AdminOverrideResult,
} from "./cancellation.js";
export {
	activateGuaranteeBaseline,
	type ActivateGuaranteeParams,
	type ActivateGuaranteeResult,
} from "./activate.js";

export const GUARANTEE_BASELINE_JOB_PREFIX = "guarantee:baseline:";

/**
 * Derive the BullMQ jobId used for guarantee baseline scans — the Stripe
 * subscription ID makes it idempotent across webhook retries. Subscription
 * IDs are opaque (e.g. `sub_1NabcDEF...`), so prefixing provides a simple
 * grep pattern for the worker's terminal-failure handler.
 */
export function guaranteeBaselineJobId(subscriptionId: string): string {
	return `${GUARANTEE_BASELINE_JOB_PREFIX}${subscriptionId}`;
}
