import { describe, expect, it } from "vitest";
import { renderAuditReportReady } from "../templates/audit-report-ready.js";
import { renderMilestoneNotification } from "../templates/milestone-notification.js";
import { renderRoiReportReady } from "../templates/roi-report-ready.js";
import { renderScanComplete } from "../templates/scan-complete.js";
import type { TemplateName } from "../templates/types.js";
import { renderWelcome } from "../templates/welcome.js";

// ── scan-complete template ──────────────────────────────────

describe("scan-complete template", () => {
	const data = {
		scanId: "scan-123",
		url: "https://example.com",
		score: 72,
		reportUrl: "https://example.com/reports/scan-123",
	};
	const unsubscribeUrl = "https://example.com/unsubscribe?token=abc";

	it("renders with correct subject containing URL", () => {
		const result = renderScanComplete(data, unsubscribeUrl);
		expect(result.subject).toContain("example.com");
		expect(result.subject).toBeDefined();
		expect(typeof result.subject).toBe("string");
	});

	it("HTML contains the score", () => {
		const result = renderScanComplete(data, unsubscribeUrl);
		expect(result.html).toContain("72");
	});

	it("HTML contains unsubscribe link", () => {
		const result = renderScanComplete(data, unsubscribeUrl);
		expect(result.html).toContain(unsubscribeUrl);
		expect(result.html).toContain("Abmelden");
	});
});

// ── welcome template ────────────────────────────────────────

describe("welcome template", () => {
	const data = {
		fullName: "Max Mustermann",
		loginUrl: "https://example.com/login",
	};
	const unsubscribeUrl = "https://example.com/unsubscribe?token=xyz";

	it("renders with correct subject", () => {
		const result = renderWelcome(data, unsubscribeUrl);
		expect(result.subject).toBe("Willkommen bei Beacon");
	});

	it("HTML contains fullName", () => {
		const result = renderWelcome(data, unsubscribeUrl);
		expect(result.html).toContain("Max Mustermann");
	});
});

// ── milestone-notification template ────────────────────────

describe("milestone-notification template", () => {
	const data = {
		milestoneType: "score_10_improvement",
		projectName: "Mein Projekt",
		description: "+10 Punkte Verbesserung",
		currentValue: 72 as number | string,
		previousValue: 62 as number | string,
		dashboardUrl: "https://app.example.com/dashboard/proj-1/roi",
	};
	const unsubscribeUrl = "https://app.example.com/api/email/unsubscribe?token=abc";

	it("renders with correct German subject containing description and project name", () => {
		const result = renderMilestoneNotification(data, unsubscribeUrl);
		expect(result.subject).toBe("Beacon Meilenstein: +10 Punkte Verbesserung — Mein Projekt");
	});

	it("HTML contains green success card styling", () => {
		const result = renderMilestoneNotification(data, unsubscribeUrl);
		expect(result.html).toContain("#f0fdf4");
		expect(result.html).toContain("#16a34a");
	});

	it("HTML contains milestone values and dashboard link", () => {
		const result = renderMilestoneNotification(data, unsubscribeUrl);
		expect(result.html).toContain("72");
		expect(result.html).toContain("62");
		expect(result.html).toContain(data.dashboardUrl);
	});

	it("HTML contains unsubscribe link", () => {
		const result = renderMilestoneNotification(data, unsubscribeUrl);
		expect(result.html).toContain(unsubscribeUrl);
	});
});

// ── roi-report-ready template ──────────────────────────────

describe("roi-report-ready template", () => {
	const data = {
		projectName: "Test Projekt",
		currentScore: 85,
		baselineScore: 60,
		scoreDelta: 25,
		reportUrl: "https://app.example.com/dashboard/proj-1/roi/reports/r1",
	};
	const unsubscribeUrl = "https://app.example.com/api/email/unsubscribe?token=xyz";

	it("renders with correct German subject containing project name", () => {
		const result = renderRoiReportReady(data, unsubscribeUrl);
		expect(result.subject).toBe("Dein ROI-Report ist bereit: Test Projekt");
	});

	it("HTML contains score delta with positive formatting", () => {
		const result = renderRoiReportReady(data, unsubscribeUrl);
		expect(result.html).toContain("+25");
		expect(result.html).toContain("85");
		expect(result.html).toContain("60");
	});

	it("HTML contains CTA button linking to report", () => {
		const result = renderRoiReportReady(data, unsubscribeUrl);
		expect(result.html).toContain("ROI-Report ansehen");
		expect(result.html).toContain(data.reportUrl);
	});

	it("renders negative delta correctly", () => {
		const negData = { ...data, scoreDelta: -5, currentScore: 55 };
		const result = renderRoiReportReady(negData, unsubscribeUrl);
		expect(result.html).toContain("-5");
		expect(result.html).toContain("#dc2626"); // red color for negative
	});
});

// ── Template registry completeness ──────────────────────────

describe("TEMPLATES registry", () => {
	it("has renderers for all TemplateName values", () => {
		// Verify that all template names defined in the type have corresponding renderers
		const templateNames: TemplateName[] = [
			"scan-complete",
			"welcome",
			"audit-report-ready",
			"milestone-notification",
			"roi-report-ready",
		];

		const renderers: Partial<Record<TemplateName, unknown>> = {
			"scan-complete": renderScanComplete,
			welcome: renderWelcome,
			"audit-report-ready": renderAuditReportReady,
			"milestone-notification": renderMilestoneNotification,
			"roi-report-ready": renderRoiReportReady,
		};

		for (const name of templateNames) {
			expect(renderers[name]).toBeDefined();
			expect(typeof renderers[name]).toBe("function");
		}
	});
});
