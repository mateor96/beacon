import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import process from "node:process";

/**
 * AES-256-GCM envelope encryption for CMS credentials (#223).
 *
 * Envelope format (stored as TEXT in the DB column
 * `cms_connections.encrypted_credentials`):
 *
 *   JSON.stringify({
 *     v: 1,                  // schema version
 *     kid: "cms-v1",         // key id (rotation hook)
 *     iv:  "<base64>",       // 12 random bytes
 *     tag: "<base64>",       // 16-byte GCM auth tag
 *     ct:  "<base64>",       // ciphertext
 *   })
 *
 * AAD: bound to row identity via `cmsCredentialsAad(connectionId, userId)`.
 * Required at both encrypt and decrypt; tampering with the row's id or
 * user_id invalidates the auth tag.
 *
 * Rotation: register a second key under a new kid (e.g. `cms-v2`) in
 * ENV_VAR_BY_KID. The decrypt path looks up the key by envelope kid;
 * re-encrypt is lazy on the next credential update.
 */

export interface EncryptionEnvelope {
	v: 1;
	kid: string;
	iv: string;
	tag: string;
	ct: string;
}

export interface EncryptParams {
	plaintext: string;
	/** Bound to row identity. REQUIRED. */
	aad: string;
}

export interface DecryptParams {
	envelope: string;
	aad: string;
}

export class CmsCredentialsKeyMissingError extends Error {
	constructor(kid: string) {
		super(`Encryption key "${kid}" is missing or invalid (expected base64, 32 bytes).`);
		this.name = "CmsCredentialsKeyMissingError";
	}
}

export class CmsCredentialsDecryptError extends Error {
	constructor(msg: string) {
		super(`CMS credentials decrypt failed: ${msg}`);
		this.name = "CmsCredentialsDecryptError";
	}
}

const ACTIVE_KID = "cms-v1";

/**
 * Map from key id to environment variable name. Add a new entry to rotate.
 * The active kid governs which key is used to encrypt new envelopes; the
 * decrypt path can resolve any kid in the map for in-flight rotation.
 */
const ENV_VAR_BY_KID: Record<string, string> = {
	"cms-v1": "CMS_CREDENTIALS_KEY",
	"provider-v1": "PROVIDER_KEYS_KEY",
};

const KEY_CACHE = new Map<string, Buffer>();

function loadKey(kid: string): Buffer {
	const cached = KEY_CACHE.get(kid);
	if (cached) return cached;
	const envVar = ENV_VAR_BY_KID[kid];
	if (!envVar) throw new CmsCredentialsKeyMissingError(kid);
	const raw = process.env[envVar];
	if (!raw) throw new CmsCredentialsKeyMissingError(kid);
	let key: Buffer;
	try {
		key = Buffer.from(raw, "base64");
	} catch {
		throw new CmsCredentialsKeyMissingError(kid);
	}
	if (key.length !== 32) throw new CmsCredentialsKeyMissingError(kid);
	KEY_CACHE.set(kid, key);
	return key;
}

function assertEnvelopeShape(o: unknown): asserts o is EncryptionEnvelope {
	if (!o || typeof o !== "object") {
		throw new CmsCredentialsDecryptError("envelope is not an object");
	}
	const e = o as Record<string, unknown>;
	if (e.v !== 1) throw new CmsCredentialsDecryptError(`unknown version ${String(e.v)}`);
	if (typeof e.kid !== "string") throw new CmsCredentialsDecryptError("missing kid");
	if (typeof e.iv !== "string" || typeof e.tag !== "string" || typeof e.ct !== "string") {
		throw new CmsCredentialsDecryptError("missing iv/tag/ct");
	}
}

function encryptWithKid(plaintext: string, aad: string | undefined, kid: string): string {
	if (!aad) throw new CmsCredentialsDecryptError("aad required");
	const key = loadKey(kid);
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	cipher.setAAD(Buffer.from(aad, "utf8"));
	const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	const envelope: EncryptionEnvelope = {
		v: 1,
		kid,
		iv: iv.toString("base64"),
		tag: tag.toString("base64"),
		ct: ct.toString("base64"),
	};
	return JSON.stringify(envelope);
}

// Decrypt is kid-agnostic: the kid is read from the envelope, so the same
// routine handles every secret domain (CMS credentials, provider keys, …).
function decryptEnvelope({ envelope, aad }: DecryptParams): string {
	if (!aad) throw new CmsCredentialsDecryptError("aad required");
	let parsed: unknown;
	try {
		parsed = JSON.parse(envelope);
	} catch {
		throw new CmsCredentialsDecryptError("envelope is not valid JSON");
	}
	assertEnvelopeShape(parsed);
	const key = loadKey(parsed.kid);
	const iv = Buffer.from(parsed.iv, "base64");
	const tag = Buffer.from(parsed.tag, "base64");
	const ct = Buffer.from(parsed.ct, "base64");
	if (iv.length !== 12) throw new CmsCredentialsDecryptError("invalid iv length");
	if (tag.length !== 16) throw new CmsCredentialsDecryptError("invalid tag length");
	const decipher = createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAAD(Buffer.from(aad, "utf8"));
	decipher.setAuthTag(tag);
	try {
		const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
		return pt.toString("utf8");
	} catch {
		throw new CmsCredentialsDecryptError("authentication failed (tamper or wrong key/aad)");
	}
}

export function encryptCmsCredentials({ plaintext, aad }: EncryptParams): string {
	return encryptWithKid(plaintext, aad, ACTIVE_KID);
}

export function decryptCmsCredentials(params: DecryptParams): string {
	return decryptEnvelope(params);
}

/** Encrypt an AI provider API key (kid `provider-v1`, key `PROVIDER_KEYS_KEY`). */
export function encryptProviderKey({ plaintext, aad }: EncryptParams): string {
	return encryptWithKid(plaintext, aad, "provider-v1");
}

/** Decrypt an AI provider API key envelope. */
export function decryptProviderKey(params: DecryptParams): string {
	return decryptEnvelope(params);
}

/**
 * AAD helper. MUST be used at both encrypt and decrypt time. Binds the
 * envelope to the row id so that swapping `id` in the database invalidates
 * the auth tag at decrypt time. The previous version also bound to
 * `user_id`; that field was dropped in v0.2 (instance-scoped feature
 * reactivation, #2).
 */
export function cmsCredentialsAad(connectionId: string): string {
	return `cms_connection:${connectionId}`;
}

/**
 * AAD helper for webhook endpoint secrets. Different prefix from
 * cmsCredentialsAad so encrypted-secret swaps between the two surfaces
 * fail the auth-tag check.
 */
export function webhookSecretAad(endpointId: string): string {
	return `webhook_endpoint:${endpointId}`;
}

/**
 * Test-only: clear the in-memory key cache between tests that mutate
 * `process.env.CMS_CREDENTIALS_KEY`. Not part of the public runtime API.
 */
export function __resetKeyCacheForTests(): void {
	KEY_CACHE.clear();
}
