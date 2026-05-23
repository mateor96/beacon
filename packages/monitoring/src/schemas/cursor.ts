// Cursor encoding for keyset pagination over (timestamp, id) tuples.
// Format: base64url(JSON({t: ISO string, id: uuid}))

export type Cursor = { t: Date; id: string };

export class InvalidCursorError extends Error {
	constructor(message = "Ungültiger Cursor") {
		super(message);
		this.name = "InvalidCursorError";
	}
}

function toBase64Url(input: string): string {
	// btoa expects a binary string (latin1). Encode UTF-8 via TextEncoder first.
	const bytes = new TextEncoder().encode(input);
	let bin = "";
	for (const byte of bytes) bin += String.fromCharCode(byte);
	const b64 = btoa(bin);
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
	const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
	const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function encodeCursor(c: Cursor): string {
	if (!(c.t instanceof Date) || Number.isNaN(c.t.getTime())) {
		throw new InvalidCursorError("Invalid cursor timestamp");
	}
	if (typeof c.id !== "string" || c.id.length === 0) {
		throw new InvalidCursorError("Invalid cursor id");
	}
	return toBase64Url(JSON.stringify({ t: c.t.toISOString(), id: c.id }));
}

export function decodeCursor(input: string): Cursor {
	let raw: string;
	try {
		raw = fromBase64Url(input);
	} catch {
		throw new InvalidCursorError();
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new InvalidCursorError();
	}
	if (
		!parsed ||
		typeof parsed !== "object" ||
		typeof (parsed as { t?: unknown }).t !== "string" ||
		typeof (parsed as { id?: unknown }).id !== "string"
	) {
		throw new InvalidCursorError();
	}
	const t = new Date((parsed as { t: string }).t);
	if (Number.isNaN(t.getTime())) throw new InvalidCursorError();
	return { t, id: (parsed as { id: string }).id };
}
