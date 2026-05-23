import type { WebhookEnvelope } from "../envelope.js";
import type { ExportCompletedEvent } from "../events/export.completed.js";
import type { FixDeployedEvent } from "../events/fix.deployed.js";
import type { FixFailedEvent } from "../events/fix.failed.js";
import type { ScanCompletedEvent } from "../events/scan.completed.js";
import type { ScanFailedEvent } from "../events/scan.failed.js";
import type { ScanStartedEvent } from "../events/scan.started.js";
import type { ScoreChangedEvent } from "../events/score.changed.js";
import type { SubscriptionChangedEvent } from "../events/subscription.changed.js";

export const scanStartedExample: ScanStartedEvent = {
	scanId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	url: "https://example.com",
	triggeredBy: "api",
};

export const scanCompletedExample: ScanCompletedEvent = {
	scanId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	url: "https://example.com",
	overallScore: 72,
	readinessLevel: 2,
	checksRun: 10,
};

export const scanFailedExample: ScanFailedEvent = {
	scanId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	url: "https://example.com",
	error: "Connection timeout after 30000ms",
	durationMs: 30000,
};

export const scoreChangedExample: ScoreChangedEvent = {
	projectId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
	websiteUrl: "https://example.com",
	previousScore: 58,
	currentScore: 72,
	delta: 14,
	readinessLevel: 2,
};

export const fixDeployedExample: FixDeployedEvent = {
	deploymentId: "c3d4e5f6-a7b8-9012-cdef-123456789012",
	fixId: "d4e5f6a7-b8c9-0123-defa-234567890123",
	fixType: "schema-org",
	cmsType: "wordpress",
	siteUrl: "https://example.com",
	status: "deployed",
};

export const fixFailedExample: FixFailedEvent = {
	deploymentId: "c3d4e5f6-a7b8-9012-cdef-123456789012",
	fixId: "d4e5f6a7-b8c9-0123-defa-234567890123",
	fixType: "schema-org",
	cmsType: "wordpress",
	siteUrl: "https://example.com",
	error: "CMS authentication failed",
	errorCode: "CMS_AUTH_ERROR",
};

export const exportCompletedExample: ExportCompletedEvent = {
	exportId: "e5f6a7b8-c9d0-1234-efab-345678901234",
	format: "csv",
	rowCount: 150,
	downloadUrl: "https://storage.example.com/exports/report-2024.csv",
};

export const subscriptionChangedExample: SubscriptionChangedEvent = {
	userId: "f6a7b8c9-d0e1-2345-fabc-456789012345",
	previousPlan: "starter",
	newPlan: "pro",
	changeType: "upgrade",
};

export const envelopeExample: WebhookEnvelope<ScanCompletedEvent> = {
	id: "10203040-5060-7080-90a0-b0c0d0e0f000",
	event: "scan.completed",
	created_at: "2024-12-01T12:00:00Z",
	schema_version: 1,
	data: scanCompletedExample,
};

export const EXAMPLE_FIXTURES = {
	"scan.started": scanStartedExample,
	"scan.completed": scanCompletedExample,
	"scan.failed": scanFailedExample,
	"score.changed": scoreChangedExample,
	"fix.deployed": fixDeployedExample,
	"fix.failed": fixFailedExample,
	"export.completed": exportCompletedExample,
	"subscription.changed": subscriptionChangedExample,
} as const;
