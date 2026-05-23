/**
 * Minimal in-memory ZIP writer (STORE mode, no compression) for fix
 * bundles (#263). Builds a single Uint8Array ready to stream to the
 * client. Pure JS — no external dependencies.
 *
 * Uses ZIP STORE (method=0) so every byte is exactly the source. This
 * produces slightly larger archives than DEFLATE but avoids pulling in
 * zlib bindings and keeps the writer correctness trivially verifiable.
 */

// ── CRC-32 (IEEE 802.3) ─────────────────────────────────────

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		t[i] = c;
	}
	return t;
})();

export function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) {
		c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xff];
	}
	return (c ^ 0xffffffff) >>> 0;
}

// ── ZIP builder ─────────────────────────────────────────────

export interface ZipEntry {
	path: string;
	content: string | Uint8Array;
}

function toBytes(value: string | Uint8Array): Uint8Array {
	return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

function u16(n: number): number[] {
	return [n & 0xff, (n >>> 8) & 0xff];
}

function u32(n: number): number[] {
	return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

/**
 * Build a ZIP archive from the given entries. Returns a Uint8Array.
 * Duplicates are not de-duplicated — callers must ensure unique paths.
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
	const localParts: number[] = [];
	const centralParts: number[] = [];
	let offset = 0;

	for (const entry of entries) {
		const nameBytes = new TextEncoder().encode(entry.path);
		const dataBytes = toBytes(entry.content);
		const crc = crc32(dataBytes);
		const size = dataBytes.length;

		// Local file header
		const localHeader = [
			...u32(0x04034b50), // signature
			...u16(20), // version needed
			...u16(0), // flags
			...u16(0), // method = STORE
			...u16(0), // mod time
			...u16(0), // mod date
			...u32(crc),
			...u32(size),
			...u32(size),
			...u16(nameBytes.length),
			...u16(0), // extra length
		];
		localParts.push(...localHeader, ...nameBytes, ...dataBytes);

		// Central directory entry (will be appended after all local entries)
		const centralHeader = [
			...u32(0x02014b50), // signature
			...u16(20), // version made by
			...u16(20), // version needed
			...u16(0), // flags
			...u16(0), // method
			...u16(0), // mod time
			...u16(0), // mod date
			...u32(crc),
			...u32(size),
			...u32(size),
			...u16(nameBytes.length),
			...u16(0), // extra length
			...u16(0), // comment length
			...u16(0), // disk
			...u16(0), // internal attrs
			...u32(0), // external attrs
			...u32(offset), // offset to local header
		];
		centralParts.push(...centralHeader, ...nameBytes);

		offset += localHeader.length + nameBytes.length + dataBytes.length;
	}

	const centralStart = offset;
	const centralSize = centralParts.length;

	// End of central directory record
	const eocd = [
		...u32(0x06054b50),
		...u16(0), // disk
		...u16(0), // start disk
		...u16(entries.length),
		...u16(entries.length),
		...u32(centralSize),
		...u32(centralStart),
		...u16(0), // comment length
	];

	const all = [...localParts, ...centralParts, ...eocd];
	return new Uint8Array(all);
}
