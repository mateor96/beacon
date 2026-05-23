import { describe, expect, it } from "vitest";
import { EXAMPLE_FIXTURES, envelopeExample } from "../webhooks/__fixtures__/examples.js";
import { WebhookEnvelopeSchema } from "../webhooks/envelope.js";
import {
	WEBHOOK_EVENTS,
	WEBHOOK_EVENT_NAMES,
	type WebhookEventName,
} from "../webhooks/events/index.js";

describe("Webhook Event Schemas", () => {
	const eventNames: WebhookEventName[] = [
		"scan.started",
		"scan.completed",
		"scan.failed",
		"score.changed",
		"fix.deployed",
		"fix.failed",
		"export.completed",
		"subscription.changed",
	];

	it("registry contains all 8 event names", () => {
		expect(WEBHOOK_EVENT_NAMES).toHaveLength(8);
		for (const name of eventNames) {
			expect(WEBHOOK_EVENT_NAMES).toContain(name);
		}
	});

	describe.each(eventNames)("%s schema validates its example fixture", (eventName) => {
		it("parses successfully", () => {
			const schema = WEBHOOK_EVENTS[eventName];
			const fixture = EXAMPLE_FIXTURES[eventName];
			const result = schema.safeParse(fixture);
			expect(result.success).toBe(true);
		});
	});

	it("envelope wraps event data correctly", () => {
		const result = WebhookEnvelopeSchema.safeParse(envelopeExample);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.event).toBe("scan.completed");
			expect(result.data.schema_version).toBe(1);
			expect(result.data.data).toBeDefined();
		}
	});

	it("rejects invalid payloads", () => {
		const invalidScanStarted = {
			scanId: "not-a-uuid",
			url: "not-a-url",
			triggeredBy: 123,
		};
		const result = WEBHOOK_EVENTS["scan.started"].safeParse(invalidScanStarted);
		expect(result.success).toBe(false);
	});

	it("rejects envelope with invalid schema_version", () => {
		const badEnvelope = {
			...envelopeExample,
			schema_version: 2,
		};
		const result = WebhookEnvelopeSchema.safeParse(badEnvelope);
		expect(result.success).toBe(false);
	});

	it("rejects envelope with missing required fields", () => {
		const incomplete = {
			id: envelopeExample.id,
			event: "scan.completed",
		};
		const result = WebhookEnvelopeSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});
});
