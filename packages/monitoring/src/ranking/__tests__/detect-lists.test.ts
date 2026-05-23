import { describe, expect, it } from "vitest";
import { detectLists } from "../detect-lists.js";
import {
	RESPONSE_BULLET_LIST,
	RESPONSE_EMPTY,
	RESPONSE_GERMAN_LIST,
	RESPONSE_HEADED_LIST,
	RESPONSE_MIXED,
	RESPONSE_NO_LIST,
	RESPONSE_NUMBERED_LIST,
	RESPONSE_PARENTHESIS_LIST,
	RESPONSE_TOP_N,
	RESPONSE_TWO_ITEMS,
} from "./fixtures.js";

describe("detectLists", () => {
	it("detects numbered list with dot delimiter (top-n when header present)", () => {
		const lists = detectLists(RESPONSE_NUMBERED_LIST);
		expect(lists.length).toBeGreaterThanOrEqual(1);
		// "top 5" in the header triggers top-n detection
		expect(lists[0].format).toBe("top-n");
		expect(lists[0].items.length).toBe(5);
		expect(lists[0].items[0].position).toBe(1);
		expect(lists[0].items[0].text).toContain("Salesforce");
	});

	it("detects bullet list", () => {
		const lists = detectLists(RESPONSE_BULLET_LIST);
		expect(lists.length).toBeGreaterThanOrEqual(1);
		expect(lists[0].format).toBe("bullet");
		expect(lists[0].items.length).toBe(4);
	});

	it("detects headed list", () => {
		const lists = detectLists(RESPONSE_HEADED_LIST);
		expect(lists.length).toBeGreaterThanOrEqual(1);
		expect(lists[0].format).toBe("headed");
		expect(lists[0].items.length).toBe(3);
	});

	it("detects Top N pattern and marks as top-n", () => {
		const lists = detectLists(RESPONSE_TOP_N);
		expect(lists.length).toBeGreaterThanOrEqual(1);
		expect(lists[0].format).toBe("top-n");
		expect(lists[0].items.length).toBe(3);
	});

	it("detects parenthesis-delimited numbered list", () => {
		const lists = detectLists(RESPONSE_PARENTHESIS_LIST);
		expect(lists.length).toBeGreaterThanOrEqual(1);
		expect(lists[0].items.length).toBe(3);
	});

	it("rejects list with fewer than 3 items (default threshold)", () => {
		const lists = detectLists(RESPONSE_TWO_ITEMS);
		expect(lists.length).toBe(0);
	});

	it("accepts list with fewer items when threshold lowered", () => {
		const lists = detectLists(RESPONSE_TWO_ITEMS, { minListItems: 2 });
		expect(lists.length).toBeGreaterThanOrEqual(1);
	});

	it("detects German-language numbered list", () => {
		const lists = detectLists(RESPONSE_GERMAN_LIST);
		expect(lists.length).toBeGreaterThanOrEqual(1);
		expect(lists[0].items.length).toBe(3);
	});

	it("detects list in mixed content", () => {
		const lists = detectLists(RESPONSE_MIXED);
		expect(lists.length).toBeGreaterThanOrEqual(1);
		expect(lists[0].items.length).toBe(3);
	});

	it("returns empty for empty text", () => {
		expect(detectLists(RESPONSE_EMPTY)).toEqual([]);
	});

	it("returns empty for text without lists", () => {
		expect(detectLists(RESPONSE_NO_LIST)).toEqual([]);
	});

	it("prioritizes numbered over bullet lists", () => {
		const text = "Numbered:\n1. A\n2. B\n3. C\n\nBullet:\n- X\n- Y\n- Z";
		const lists = detectLists(text);
		expect(lists[0].format).toBe("numbered");
	});

	it("strips markdown from list items", () => {
		const text =
			"1. **Bold Brand** - description\n2. *Italic Brand* - info\n3. `Code Brand` - details";
		const lists = detectLists(text);
		expect(lists[0].items[0].text).toBe("Bold Brand - description");
	});

	it("records correct charOffset for items", () => {
		const lists = detectLists(RESPONSE_NUMBERED_LIST);
		expect(lists[0].items[0].charOffset).toBeGreaterThan(0);
		expect(lists[0].items[1].charOffset).toBeGreaterThan(lists[0].items[0].charOffset);
	});
});
