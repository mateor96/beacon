import { createHmac } from "node:crypto";
import { db, webhookQueries } from "@beacon/db";
import type { WebhookDeliveryJobData, WebhookDeliveryJobResult } from "@beacon/queue";
import { decryptCmsCredentials, webhookSecretAad } from "@beacon/shared/crypto-aes-gcm";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

const MAX_RESPONSE_BODY = 1024;
const TIMEOUT_MS = 10_000;

/**
 * Outbound webhook delivery (v0.2 #9).
 *
 * Headers (HMAC over `${timestamp}.${payload}`):
 *   - X-Beacon-Signature
 *   - X-Beacon-Timestamp
 *   - X-Beacon-Idempotency-Key
 *
 * Retry policy: 5 attempts / 2s exponential. After the 5th failure the
 * delivery is dead-lettered: webhook_deliveries.status = "dead_letter"
 * and the cron DLQ table picks up the BullMQ failure separately.
 */
export async function processWebhookDelivery(
	job: Job<WebhookDeliveryJobData, WebhookDeliveryJobResult>,
): Promise<WebhookDeliveryJobResult> {
	const {
		deliveryId,
		endpointId,
		endpointUrl,
		encryptedSecret,
		eventType,
		payload,
		idempotencyKey,
	} = job.data;

	const log = createJobLogger({
		queue: "webhook-delivery",
		jobId: job.id ?? "unknown",
		scanId: deliveryId,
	});

	log.info("Delivering webhook", { endpointId, eventType, deliveryId });

	// 1. Decrypt endpoint secret using the AAD bound to the endpoint id.
	const aad = webhookSecretAad(endpointId);
	const secret = decryptCmsCredentials({ envelope: encryptedSecret, aad });

	// 2. Compute HMAC over timestamp + payload.
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

	// 3. POST with 10s timeout.
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

	let responseStatus: number | null = null;
	let responseBody: string | null = null;

	try {
		const response = await fetch(endpointUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "BeaconBot/1.0",
				"X-Beacon-Signature": signature,
				"X-Beacon-Timestamp": timestamp,
				"X-Beacon-Idempotency-Key": idempotencyKey,
			},
			body: payload,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		responseStatus = response.status;

		try {
			const fullBody = await response.text();
			responseBody = fullBody.slice(0, MAX_RESPONSE_BODY);
		} catch {
			responseBody = null;
		}

		const isSuccess = responseStatus >= 200 && responseStatus < 300;
		const maxAttempts = job.opts.attempts ?? 5;
		const isTerminal = !isSuccess && job.attemptsMade + 1 >= maxAttempts;

		const status = isSuccess ? "delivered" : isTerminal ? "dead_letter" : "failed";

		await webhookQueries.updateDeliveryStatus(
			db,
			deliveryId,
			status,
			responseStatus,
			responseBody,
			job.attemptsMade + 1,
		);

		if (isSuccess) {
			log.info("Webhook delivered", { deliveryId, responseStatus });
			return { deliveryId, status: "success", responseStatus };
		}

		log.error("Webhook delivery failed", {
			deliveryId,
			responseStatus,
			responseBody: responseBody?.slice(0, 200),
		});
		throw new Error(`Webhook delivery failed: HTTP ${responseStatus}`);
	} catch (err) {
		clearTimeout(timeoutId);

		if (err instanceof DOMException && err.name === "AbortError") {
			const maxAttempts = job.opts.attempts ?? 5;
			const isTerminal = job.attemptsMade + 1 >= maxAttempts;

			await webhookQueries.updateDeliveryStatus(
				db,
				deliveryId,
				isTerminal ? "dead_letter" : "failed",
				null,
				"Request timed out after 10s",
				job.attemptsMade + 1,
			);

			log.error("Webhook delivery timed out", { deliveryId, endpointUrl });
			throw new Error("Webhook delivery timed out after 10s");
		}

		// Re-throw the structured "Webhook delivery failed: HTTP NNN" from
		// the success branch so BullMQ retries with the right shape.
		if (err instanceof Error && err.message.startsWith("Webhook delivery failed:")) {
			throw err;
		}

		try {
			const maxAttempts = job.opts.attempts ?? 5;
			const isTerminal = job.attemptsMade + 1 >= maxAttempts;
			await webhookQueries.updateDeliveryStatus(
				db,
				deliveryId,
				isTerminal ? "dead_letter" : "failed",
				null,
				err instanceof Error ? err.message.slice(0, MAX_RESPONSE_BODY) : "Unknown error",
				job.attemptsMade + 1,
			);
		} catch {
			// Best effort — don't mask the original error.
		}

		throw err;
	}
}
