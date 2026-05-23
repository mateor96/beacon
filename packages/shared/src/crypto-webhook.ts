import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import process from "node:process";

/**
 * AES-256-GCM envelope encryption for webhook endpoint secrets (#276).
 *
 * Same envelope format as crypto-aes-gcm.ts (CMS credentials) but with a
 * separate key (WEBHOOK_SECRET_KEY) so that compromise of one key does not
 * expose the other.
 *
 * Envelope format (stored as TEXT in `webhook_endpoints.encrypted_secret`):
 *
 *   JSON.stringify({
 *     v: 1,
 *     kid: "whsec-v1",
 *     iv:  "<base64>",   // 12 random bytes
 *     tag: "<base64>",   // 16-byte GCM auth tag
 *     ct:  "<base64>",   // ciphertext
 *   })
 *
 * AAD: bound to row identity via `webhookSecretAad(endpointId, userId)`.
 */

export interface WebhookEncryptionEnvelope {
	v: 1;
	kid: string;
	iv: string;
	tag: string;
	ct: string;
}

export class WebhookSecretKeyMissingError extends Error {
	constructor(kid: string) {
		super(`Webhook encryption key "${kid}" is missing or invalid (expected base64, 32 bytes).`);
		this.name = "WebhookSecretKeyMissingError";
	}
}

export class WebhookSecretDecryptError extends Error {
	constructor(msg: string) {
		super(`Webhook secret decrypt failed: ${msg}`);
		this.name = "WebhookSecretDecryptError";
	}
}

const ACTIVE_KID = "whsec-v1";

const ENV_VAR_BY_KID: Record<string, string> = {
	"whsec-v1": "WEBHOOK_SECRET_KEY",
};

const KEY_CACHE = new Map<string, Buffer>();

function loadKey(kid: string): Buffer {
	const cached = KEY_CACHE.get(kid);
	if (cached) return cached;
	const envVar = ENV_VAR_BY_KID[kid];
	if (!envVar) throw new WebhookSecretKeyMissingError(kid);
	const raw = process.env[envVar];
	if (!raw) throw new WebhookSecretKeyMissingError(kid);
	let key: Buffer;
	try {
		key = Buffer.from(raw, "base64");
	} catch {
		throw new WebhookSecretKeyMissingError(kid);
	}
	if (key.length !== 32) throw new WebhookSecretKeyMissingError(kid);
	KEY_CACHE.set(kid, key);
	return key;
}

function assertEnvelopeShape(o: unknown): asserts o is WebhookEncryptionEnvelope {
	if (!o || typeof o !== "object") {
		throw new WebhookSecretDecryptError("envelope is not an object");
	}
	const e = o as Record<string, unknown>;
	if (e.v !== 1) throw new WebhookSecretDecryptError(`unknown version ${String(e.v)}`);
	if (typeof e.kid !== "string") throw new WebhookSecretDecryptError("missing kid");
	if (typeof e.iv !== "string" || typeof e.tag !== "string" || typeof e.ct !== "string") {
		throw new WebhookSecretDecryptError("missing iv/tag/ct");
	}
}

export function encryptWebhookSecret(plaintext: string, aad: string): string {
	if (!aad) throw new WebhookSecretDecryptError("aad required");
	const key = loadKey(ACTIVE_KID);
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	cipher.setAAD(Buffer.from(aad, "utf8"));
	const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	const envelope: WebhookEncryptionEnvelope = {
		v: 1,
		kid: ACTIVE_KID,
		iv: iv.toString("base64"),
		tag: tag.toString("base64"),
		ct: ct.toString("base64"),
	};
	return JSON.stringify(envelope);
}

export function decryptWebhookSecret(envelope: string, aad: string): string {
	if (!aad) throw new WebhookSecretDecryptError("aad required");
	let parsed: unknown;
	try {
		parsed = JSON.parse(envelope);
	} catch {
		throw new WebhookSecretDecryptError("envelope is not valid JSON");
	}
	assertEnvelopeShape(parsed);
	const key = loadKey(parsed.kid);
	const iv = Buffer.from(parsed.iv, "base64");
	const tag = Buffer.from(parsed.tag, "base64");
	const ct = Buffer.from(parsed.ct, "base64");
	if (iv.length !== 12) throw new WebhookSecretDecryptError("invalid iv length");
	if (tag.length !== 16) throw new WebhookSecretDecryptError("invalid tag length");
	const decipher = createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAAD(Buffer.from(aad, "utf8"));
	decipher.setAuthTag(tag);
	try {
		const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
		return pt.toString("utf8");
	} catch {
		throw new WebhookSecretDecryptError("authentication failed (tamper or wrong key/aad)");
	}
}

/**
 * AAD helper. Binds the envelope to the endpoint's identity.
 */
export function webhookSecretAad(endpointId: string, userId: string): string {
	return `webhook_endpoint:${endpointId}:user:${userId}`;
}

/**
 * Test-only: clear the in-memory key cache.
 */
export function __resetWebhookKeyCacheForTests(): void {
	KEY_CACHE.clear();
}
