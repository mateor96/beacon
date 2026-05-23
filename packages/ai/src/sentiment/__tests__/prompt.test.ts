import { describe, expect, it } from "vitest";
import { SENTIMENT_SYSTEM_PROMPT, buildUserMessage } from "../prompt.js";
import { MENTION_NEGATIVE, MENTION_NEUTRAL, MENTION_POSITIVE, makeMentions } from "./fixtures.js";

describe("SENTIMENT_SYSTEM_PROMPT", () => {
	it("is a non-empty string", () => {
		expect(SENTIMENT_SYSTEM_PROMPT.length).toBeGreaterThan(100);
	});

	it("contains German instructions", () => {
		expect(SENTIMENT_SYSTEM_PROMPT).toContain("Sentiment");
		expect(SENTIMENT_SYSTEM_PROMPT).toContain("positive");
		expect(SENTIMENT_SYSTEM_PROMPT).toContain("neutral");
		expect(SENTIMENT_SYSTEM_PROMPT).toContain("negative");
	});

	it("specifies JSON output format", () => {
		expect(SENTIMENT_SYSTEM_PROMPT).toContain("JSON");
		expect(SENTIMENT_SYSTEM_PROMPT).toContain("results");
	});
});

describe("buildUserMessage", () => {
	it("includes all mentions with indices", () => {
		const msg = buildUserMessage([MENTION_POSITIVE, MENTION_NEGATIVE]);
		expect(msg).toContain("[0]");
		expect(msg).toContain("[1]");
	});

	it("includes brand name", () => {
		const msg = buildUserMessage([MENTION_POSITIVE]);
		expect(msg).toContain("Acme Corp");
	});

	it("includes mention type", () => {
		const msg = buildUserMessage([MENTION_POSITIVE]);
		expect(msg).toContain("recommendation");
	});

	it("includes AI engine", () => {
		const msg = buildUserMessage([MENTION_POSITIVE]);
		expect(msg).toContain("chatgpt");
	});

	it("includes context text", () => {
		const msg = buildUserMessage([MENTION_POSITIVE]);
		expect(msg).toContain("recommend Acme Corp");
	});

	it("truncates context text to 200 chars", () => {
		const longMention = {
			...MENTION_POSITIVE,
			contextText: "A".repeat(300),
		};
		const msg = buildUserMessage([longMention]);
		// Should not contain 300 As, should be truncated
		expect(msg.indexOf("A".repeat(201))).toBe(-1);
	});

	it("handles empty mentions array", () => {
		const msg = buildUserMessage([]);
		expect(msg).toContain("0 Markenerwaenung");
	});

	it("handles batch of 10 mentions", () => {
		const mentions = makeMentions(10);
		const msg = buildUserMessage(mentions);
		expect(msg).toContain("[0]");
		expect(msg).toContain("[9]");
		expect(msg).toContain("10 Markenerwaenung");
	});
});
