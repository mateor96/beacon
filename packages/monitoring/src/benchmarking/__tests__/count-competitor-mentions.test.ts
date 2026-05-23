import { describe, expect, it } from "vitest";
import { countCompetitorMentions } from "../count-competitor-mentions.js";

describe("countCompetitorMentions", () => {
	it("counts single competitor occurrences", () => {
		const text = "Salesforce is a great CRM. We recommend Salesforce for enterprises.";
		const counts = countCompetitorMentions(text, ["Salesforce"]);
		expect(counts.get("Salesforce")).toBe(2);
	});

	it("counts multiple competitors", () => {
		const text =
			"Salesforce leads the market. HubSpot is good for SMBs. Pipedrive is sales-focused.";
		const counts = countCompetitorMentions(text, ["Salesforce", "HubSpot", "Pipedrive"]);
		expect(counts.get("Salesforce")).toBe(1);
		expect(counts.get("HubSpot")).toBe(1);
		expect(counts.get("Pipedrive")).toBe(1);
	});

	it("is case-insensitive for keywords > 2 chars", () => {
		const text = "salesforce and SALESFORCE are the same.";
		const counts = countCompetitorMentions(text, ["Salesforce"]);
		expect(counts.get("Salesforce")).toBe(2);
	});

	it("respects word boundaries", () => {
		const text = "The HubSpotter app is not HubSpot.";
		const counts = countCompetitorMentions(text, ["HubSpot"]);
		expect(counts.get("HubSpot")).toBe(1);
	});

	it("skips matches inside URLs", () => {
		const text = "Visit https://salesforce.com for details. Salesforce is great.";
		const counts = countCompetitorMentions(text, ["Salesforce"]);
		expect(counts.get("Salesforce")).toBe(1);
	});

	it("returns empty map for no matches", () => {
		const text = "The weather is nice today.";
		const counts = countCompetitorMentions(text, ["Salesforce"]);
		expect(counts.size).toBe(0);
	});

	it("returns empty map for empty text", () => {
		const counts = countCompetitorMentions("", ["Salesforce"]);
		expect(counts.size).toBe(0);
	});

	it("returns empty map for empty keywords", () => {
		const counts = countCompetitorMentions("Salesforce is great.", []);
		expect(counts.size).toBe(0);
	});

	it("handles special regex characters in keywords", () => {
		const text = "AT&T provides good coverage. AT&T is reliable.";
		const counts = countCompetitorMentions(text, ["AT&T"]);
		expect(counts.get("AT&T")).toBe(2);
	});

	it("skips empty keywords", () => {
		const counts = countCompetitorMentions("Some text.", ["", "Salesforce"]);
		expect(counts.has("")).toBe(false);
	});
});
