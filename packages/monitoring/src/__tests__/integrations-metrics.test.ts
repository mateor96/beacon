import { describe, expect, it } from "vitest";
import {
	apiErrorRate,
	evaluateAlerts,
	webhookFailureRate,
	webhookSuccessRate,
} from "../integrations/metrics.js";

describe("webhookSuccessRate / webhookFailureRate", () => {
	it("returns 1/0 for empty totals", () => {
		expect(
			webhookSuccessRate({
				totalDeliveries: 0,
				successfulDeliveries: 0,
				failedEndpoints: 0,
				avgLatencyMs: null,
			}),
		).toBe(1);
		expect(
			webhookFailureRate({
				totalDeliveries: 0,
				successfulDeliveries: 0,
				failedEndpoints: 0,
				avgLatencyMs: null,
			}),
		).toBe(0);
	});

	it("computes the correct ratio", () => {
		expect(
			webhookSuccessRate({
				totalDeliveries: 100,
				successfulDeliveries: 80,
				failedEndpoints: 0,
				avgLatencyMs: null,
			}),
		).toBe(0.8);
		expect(
			webhookFailureRate({
				totalDeliveries: 100,
				successfulDeliveries: 80,
				failedEndpoints: 0,
				avgLatencyMs: null,
			}),
		).toBeCloseTo(0.2, 5);
	});
});

describe("apiErrorRate", () => {
	it("returns 0 when no requests", () => {
		expect(apiErrorRate({ requestCount: 0, errorCount: 0, avgResponseMs: null })).toBe(0);
	});

	it("computes the correct ratio", () => {
		expect(apiErrorRate({ requestCount: 200, errorCount: 10, avgResponseMs: 100 })).toBe(0.05);
	});
});

describe("evaluateAlerts (#305)", () => {
	const baseline = {
		csv: { queued: 5, completed: 100, failed: 1, avgDurationMs: 5000 },
		webhooks: {
			totalDeliveries: 100,
			successfulDeliveries: 95,
			failedEndpoints: 1,
			avgLatencyMs: 200,
		},
		api: { requestCount: 1000, errorCount: 10, avgResponseMs: 50 },
		looker: { requestCount: 50, authFailures: 0, avgLatencyMs: 100 },
	};

	it("baseline produces no alerts", () => {
		expect(evaluateAlerts(baseline)).toEqual([]);
	});

	it("fires WEBHOOK_FAILURE_RATE_HIGH when failure rate > 20%", () => {
		const alerts = evaluateAlerts({
			...baseline,
			webhooks: { ...baseline.webhooks, totalDeliveries: 100, successfulDeliveries: 70 },
		});
		expect(alerts.find((a) => a.rule.id === "WEBHOOK_FAILURE_RATE_HIGH")).toBeTruthy();
	});

	it("fires API_ERROR_RATE_HIGH when error rate > 5%", () => {
		const alerts = evaluateAlerts({
			...baseline,
			api: { requestCount: 100, errorCount: 10, avgResponseMs: 50 },
		});
		expect(alerts.find((a) => a.rule.id === "API_ERROR_RATE_HIGH")).toBeTruthy();
	});

	it("fires CSV_QUEUE_BACKLOG when queued > 100", () => {
		const alerts = evaluateAlerts({
			...baseline,
			csv: { ...baseline.csv, queued: 150 },
		});
		expect(alerts.find((a) => a.rule.id === "CSV_QUEUE_BACKLOG")).toBeTruthy();
	});

	it("fires LOOKER_AUTH_FAILURES when authFailures >= 1", () => {
		const alerts = evaluateAlerts({
			...baseline,
			looker: { ...baseline.looker, authFailures: 3 },
		});
		expect(alerts.find((a) => a.rule.id === "LOOKER_AUTH_FAILURES")).toBeTruthy();
	});

	it("respects custom thresholds", () => {
		// Stricter rate => baseline 5/100 = 5% trips at threshold 0.04
		const alerts = evaluateAlerts(baseline, { webhookFailureRate: 0.04 });
		expect(alerts.find((a) => a.rule.id === "WEBHOOK_FAILURE_RATE_HIGH")).toBeTruthy();
	});

	it("alerts include German message + numeric value/threshold", () => {
		const alerts = evaluateAlerts({
			...baseline,
			csv: { ...baseline.csv, queued: 200 },
		});
		const a = alerts.find((x) => x.rule.id === "CSV_QUEUE_BACKLOG");
		expect(a?.message).toContain("CSV-Queue");
		expect(a?.value).toBe(200);
		expect(a?.threshold).toBe(100);
	});
});
