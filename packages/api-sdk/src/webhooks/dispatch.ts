import { randomUUID } from "node:crypto";
import type { WebhookEnvelope } from "./envelope.js";
import type { WebhookEventName } from "./events/index.js";

/**
 * Dispatch a webhook event to every active endpoint subscribed to
 * `eventType`. Instance-scoped (v0.2): no userId; the operator owns the
 * full set of endpoints.
 *
 *   1. Look up active endpoints subscribed to the event type.
 *   2. Create a `webhook_deliveries` row per endpoint (status = pending).
 *   3. Enqueue a BullMQ `webhook-delivery` job per delivery; the worker
 *      handles HMAC signing, retries, and dead-lettering.
 *
 * Returns the delivery ids that were created. Useful for the caller to
 * log "fired 3 webhooks for scan.completed".
 *
 * Dependencies are lazy-imported so this SDK package stays runtime-free
 * for callers that only want the envelope/event types.
 */
export async function dispatchWebhookEvent(
	eventType: WebhookEventName,
	payload: unknown,
): Promise<string[]> {
	const { db, webhookQueries } = await import("@beacon/db");
	const { addJob } = await import("@beacon/queue");

	const endpoints = await webhookQueries.getActiveEndpointsForEvent(db, eventType);
	if (endpoints.length === 0) return [];

	const envelope: WebhookEnvelope = {
		id: randomUUID(),
		event: eventType,
		created_at: new Date().toISOString(),
		schema_version: 1,
		data: payload,
	};
	const payloadJson = JSON.stringify(envelope);

	const deliveryIds: string[] = [];
	for (const endpoint of endpoints) {
		const delivery = await webhookQueries.createDelivery(db, {
			endpointId: endpoint.id,
			eventType,
			payload: { envelopeId: envelope.id, payload: payloadJson },
			status: "pending",
		});

		await addJob("webhook-delivery", {
			deliveryId: delivery.id,
			endpointId: endpoint.id,
			endpointUrl: endpoint.url,
			encryptedSecret: endpoint.encryptedSecret,
			eventType,
			payload: payloadJson,
			idempotencyKey: envelope.id,
		});

		deliveryIds.push(delivery.id);
	}

	return deliveryIds;
}
