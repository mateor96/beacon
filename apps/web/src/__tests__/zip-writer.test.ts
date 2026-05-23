import { describe, expect, it } from "vitest";
import { buildZip, crc32 } from "../lib/zip-writer";

describe("crc32 (#263)", () => {
	it("matches the IEEE 802.3 reference vector for 'hello'", () => {
		expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
	});

	it("returns 0 for empty input", () => {
		expect(crc32(new Uint8Array())).toBe(0);
	});

	it("is deterministic", () => {
		const bytes = new TextEncoder().encode("abcdef");
		expect(crc32(bytes)).toBe(crc32(bytes));
	});
});

describe("buildZip (#263)", () => {
	it("produces a ZIP with the correct signature prefix", () => {
		const zip = buildZip([{ path: "hello.txt", content: "hi" }]);
		expect(zip[0]).toBe(0x50); // P
		expect(zip[1]).toBe(0x4b); // K
		expect(zip[2]).toBe(0x03);
		expect(zip[3]).toBe(0x04);
	});

	it("includes an end-of-central-directory record (PK\\5\\6)", () => {
		const zip = buildZip([{ path: "a.txt", content: "x" }]);
		// EOCD signature appears near the end
		let found = false;
		for (let i = zip.length - 22; i >= 0; i--) {
			if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x05 && zip[i + 3] === 0x06) {
				found = true;
				break;
			}
		}
		expect(found).toBe(true);
	});

	it("embeds the filename in the local file header", () => {
		const zip = buildZip([{ path: "hello.txt", content: "x" }]);
		const s = new TextDecoder().decode(zip);
		expect(s).toContain("hello.txt");
	});

	it("embeds the file content in the local file data", () => {
		const zip = buildZip([{ path: "a.txt", content: "unique-payload-xyz" }]);
		const s = new TextDecoder().decode(zip);
		expect(s).toContain("unique-payload-xyz");
	});

	it("handles multiple entries", () => {
		const zip = buildZip([
			{ path: "one.txt", content: "first" },
			{ path: "two.txt", content: "second" },
		]);
		const s = new TextDecoder().decode(zip);
		expect(s).toContain("one.txt");
		expect(s).toContain("two.txt");
		expect(s).toContain("first");
		expect(s).toContain("second");
	});

	it("accepts Uint8Array content", () => {
		const zip = buildZip([{ path: "bin", content: new Uint8Array([1, 2, 3]) }]);
		expect(zip.length).toBeGreaterThan(0);
	});

	it("returns an empty archive for [] entries (still valid EOCD)", () => {
		const zip = buildZip([]);
		// Just the EOCD record = 22 bytes
		expect(zip.length).toBe(22);
	});
});
