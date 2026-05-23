import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../cursor.js";

describe("cursor", () => {
	it("roundtrips a cursor", () => {
		const t = new Date("2024-06-01T12:00:00.000Z");
		const id = "550e8400-e29b-41d4-a716-446655440000";
		const enc = encodeCursor({ t, id });
		const dec = decodeCursor(enc);
		expect(dec.id).toBe(id);
		expect(dec.t.toISOString()).toBe(t.toISOString());
	});

	it("encoded form is base64url (no padding, no +/)", () => {
		const enc = encodeCursor({ t: new Date(0), id: "x" });
		expect(enc).not.toContain("+");
		expect(enc).not.toContain("/");
		expect(enc).not.toContain("=");
	});

	it("throws on invalid base/json", () => {
		expect(() => decodeCursor("!!!not-valid")).toThrow();
		expect(() => decodeCursor(Buffer.from("not json").toString("base64url"))).toThrow();
	});

	it("throws on missing fields", () => {
		const bad = Buffer.from(JSON.stringify({ t: "x" }), "utf8").toString("base64url");
		expect(() => decodeCursor(bad)).toThrow();
	});

	it("throws on invalid timestamp", () => {
		const bad = Buffer.from(JSON.stringify({ t: "not-a-date", id: "x" }), "utf8").toString(
			"base64url",
		);
		expect(() => decodeCursor(bad)).toThrow();
	});

	it("encode rejects invalid date", () => {
		expect(() => encodeCursor({ t: new Date("nope"), id: "x" })).toThrow();
	});

	it("encode rejects empty id", () => {
		expect(() => encodeCursor({ t: new Date(), id: "" })).toThrow();
	});
});
