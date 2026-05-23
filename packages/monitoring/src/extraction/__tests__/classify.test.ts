import { describe, expect, it } from "vitest";
import { classifyMentionType, classifySentiment } from "../classify.js";

describe("classifyMentionType", () => {
	it("classifies recommendation (English)", () => {
		expect(classifyMentionType("I would highly recommend Acme Corp for this task.")).toBe(
			"recommendation",
		);
	});

	it("classifies recommendation (German)", () => {
		expect(classifyMentionType("Ich empfehle Acme Corp für dieses Projekt.")).toBe(
			"recommendation",
		);
	});

	it("classifies comparison with 'compared to'", () => {
		expect(classifyMentionType("Compared to other providers, Acme stands out.")).toBe("comparison");
	});

	it("classifies comparison with 'vs'", () => {
		expect(classifyMentionType("Acme Corp vs Beta Inc: which is better?")).toBe("comparison");
	});

	it("classifies comparison (German)", () => {
		expect(classifyMentionType("Im Vergleich zu anderen Anbietern ist Acme besser.")).toBe(
			"comparison",
		);
	});

	it("classifies citation with 'according to'", () => {
		expect(classifyMentionType("According to Acme's latest report, revenue grew.")).toBe(
			"citation",
		);
	});

	it("classifies citation (German)", () => {
		expect(classifyMentionType("Laut Acme Corp hat sich der Umsatz verdoppelt.")).toBe("citation");
	});

	it("defaults to passing when no keywords match", () => {
		expect(classifyMentionType("Acme Corp is located in Berlin.")).toBe("passing");
	});

	it("recommendation takes priority over comparison", () => {
		expect(classifyMentionType("I recommend Acme compared to other options.")).toBe(
			"recommendation",
		);
	});

	it("comparison takes priority over citation", () => {
		expect(classifyMentionType("According to reports, Acme is better than competitors.")).toBe(
			"comparison",
		);
	});

	it("handles empty context", () => {
		expect(classifyMentionType("")).toBe("passing");
	});
});

describe("classifySentiment", () => {
	it("positive when positive keywords dominate", () => {
		expect(classifySentiment("Acme offers excellent and reliable services.")).toBe("positive");
	});

	it("negative when negative keywords dominate", () => {
		expect(classifySentiment("Acme has poor and unreliable services.")).toBe("negative");
	});

	it("neutral when balanced", () => {
		expect(classifySentiment("Acme is a company that exists.")).toBe("neutral");
	});

	it("neutral when no keywords found", () => {
		expect(classifySentiment("The meeting is at 3pm.")).toBe("neutral");
	});

	it("handles German positive keywords", () => {
		expect(classifySentiment("Acme bietet hervorragende und zuverlässige Dienste.")).toBe(
			"positive",
		);
	});

	it("handles German negative keywords", () => {
		expect(classifySentiment("Acme hat schlecht und mangelhaft gearbeitet.")).toBe("negative");
	});

	it("handles empty context", () => {
		expect(classifySentiment("")).toBe("neutral");
	});
});
