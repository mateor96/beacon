/**
 * Integration monitoring metrics + alerting (#305).
 *
 * Pure helpers that compute metric snapshots from raw counts. Source data
 * comes from queries elsewhere (CSV exports, audit logs, webhook deliveries).
 * The admin dashboard (#305 acceptance) consumes these helpers to render
 * key numbers + threshold-based alerts without re-implementing the rules.
 */

export interface CsvExportMetrics {
	queued: number;
	completed: number;
	failed: number;
	avgDurationMs: number | null;
}

export interface WebhookMetrics {
	totalDeliveries: number;
	successfulDeliveries: number;
	failedEndpoints: number;
	avgLatencyMs: number | null;
}

export interface ApiMetrics {
	requestCount: number;
	errorCount: number; // 4xx + 5xx combined
	avgResponseMs: number | null;
}

export interface LookerMetrics {
	requestCount: number;
	authFailures: number;
	avgLatencyMs: number | null;
}

export interface IntegrationMetrics {
	csv: CsvExportMetrics;
	webhooks: WebhookMetrics;
	api: ApiMetrics;
	looker: LookerMetrics;
}

// ── Derived ratios ──────────────────────────────────────────

export function webhookSuccessRate(m: WebhookMetrics): number {
	if (m.totalDeliveries === 0) return 1;
	return m.successfulDeliveries / m.totalDeliveries;
}

export function webhookFailureRate(m: WebhookMetrics): number {
	return 1 - webhookSuccessRate(m);
}

export function apiErrorRate(m: ApiMetrics): number {
	if (m.requestCount === 0) return 0;
	return m.errorCount / m.requestCount;
}

// ── Alert rules ─────────────────────────────────────────────

export interface AlertRule {
	id: string;
	severity: "info" | "warning" | "critical";
	titleDe: string;
}

export const ALERT_RULES: Record<string, AlertRule> = {
	WEBHOOK_FAILURE_RATE_HIGH: {
		id: "WEBHOOK_FAILURE_RATE_HIGH",
		severity: "critical",
		titleDe: "Webhook-Fehlerquote über 20%",
	},
	API_ERROR_RATE_HIGH: {
		id: "API_ERROR_RATE_HIGH",
		severity: "warning",
		titleDe: "API-Fehlerquote über 5%",
	},
	CSV_QUEUE_BACKLOG: {
		id: "CSV_QUEUE_BACKLOG",
		severity: "warning",
		titleDe: "CSV-Export-Queue über 100 Jobs",
	},
	LOOKER_AUTH_FAILURES: {
		id: "LOOKER_AUTH_FAILURES",
		severity: "warning",
		titleDe: "Looker-Auth-Fehler in den letzten 24h",
	},
};

export interface FiringAlert {
	rule: AlertRule;
	value: number;
	threshold: number;
	message: string;
}

export interface EvaluateAlertsThresholds {
	webhookFailureRate?: number; // default 0.2
	apiErrorRate?: number; // default 0.05
	csvQueueBacklog?: number; // default 100
	lookerAuthFailures?: number; // default 1
}

export function evaluateAlerts(
	metrics: IntegrationMetrics,
	thresholds: EvaluateAlertsThresholds = {},
): FiringAlert[] {
	const t = {
		webhookFailureRate: thresholds.webhookFailureRate ?? 0.2,
		apiErrorRate: thresholds.apiErrorRate ?? 0.05,
		csvQueueBacklog: thresholds.csvQueueBacklog ?? 100,
		lookerAuthFailures: thresholds.lookerAuthFailures ?? 1,
	};

	const out: FiringAlert[] = [];
	const wfr = webhookFailureRate(metrics.webhooks);
	if (wfr > t.webhookFailureRate) {
		out.push({
			rule: ALERT_RULES.WEBHOOK_FAILURE_RATE_HIGH,
			value: wfr,
			threshold: t.webhookFailureRate,
			message: `Webhook-Fehlerquote ${(wfr * 100).toFixed(1)}% (Schwelle ${(t.webhookFailureRate * 100).toFixed(0)}%).`,
		});
	}
	const aer = apiErrorRate(metrics.api);
	if (aer > t.apiErrorRate) {
		out.push({
			rule: ALERT_RULES.API_ERROR_RATE_HIGH,
			value: aer,
			threshold: t.apiErrorRate,
			message: `API-Fehlerquote ${(aer * 100).toFixed(1)}% (Schwelle ${(t.apiErrorRate * 100).toFixed(0)}%).`,
		});
	}
	if (metrics.csv.queued > t.csvQueueBacklog) {
		out.push({
			rule: ALERT_RULES.CSV_QUEUE_BACKLOG,
			value: metrics.csv.queued,
			threshold: t.csvQueueBacklog,
			message: `CSV-Queue: ${metrics.csv.queued} Jobs ausstehend (Schwelle ${t.csvQueueBacklog}).`,
		});
	}
	if (metrics.looker.authFailures >= t.lookerAuthFailures) {
		out.push({
			rule: ALERT_RULES.LOOKER_AUTH_FAILURES,
			value: metrics.looker.authFailures,
			threshold: t.lookerAuthFailures,
			message: `${metrics.looker.authFailures} Looker-Auth-Fehler in den letzten 24h.`,
		});
	}
	return out;
}
