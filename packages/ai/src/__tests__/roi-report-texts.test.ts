import { describe, expect, it, vi } from "vitest";
import { generateRoiReportTexts } from "../roi-report-texts.js";
import type { RoiReportTextInput } from "../roi-report-texts.js";
import { RoiReportTextsSchema } from "../schemas.js";

// ── Fixtures ────────────────────────────────────────────────

const VALID_ROI_TEXTS = {
	executiveSummary: "Der Score hat sich seit der Baseline um 32 Punkte verbessert.",
	recommendations: [
		{
			priority: 1,
			title: "Schema.org Markup erweitern",
			description: "Strukturierte Daten für bessere KI-Sichtbarkeit hinzufügen.",
			impact: "high" as const,
		},
	],
	outlook: "Weiteres Wachstumspotenzial bei Interaktivität und Transaktionsfaehigkeit.",
};

function makeInput(overrides: Partial<RoiReportTextInput> = {}): RoiReportTextInput {
	return {
		url: "https://example.com",
		currentScore: 72,
		baselineScore: 40,
		scoreDelta: 32,
		readinessLevel: 2,
		levelScores: { readability: 80, interactivity: 55, transactional: 45 },
		subScoreDeltas: { readability: 30, interactivity: 25, transactional: 25 },
		milestones: [{ type: "score-jump", description: "Score jumped by 15 points" }],
		citationCount: 8,
		citationDelta: 6,
		daysSinceBaseline: 90,
		failingChecks: [
			{ id: "schema-org", name: "Schema.org", score: 20, summary: "Missing structured data" },
		],
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("generateRoiReportTexts", () => {
	it("returns error when no failingChecks AND no milestones (early return guard)", async () => {
		const mockClient = { complete: vi.fn() } as never;
		const input = makeInput({ failingChecks: [], milestones: [] });

		const result = await generateRoiReportTexts(input, mockClient);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.message).toContain("Keine Daten");
			expect(result.error.attempts).toBe(0);
		}
		expect(result.usage).toEqual([]);
	});

	it("calls client.complete with roi-recommendation operation", async () => {
		const complete = vi.fn().mockResolvedValue({
			text: JSON.stringify(VALID_ROI_TEXTS),
			usage: {
				inputTokens: 600,
				outputTokens: 400,
				model: "claude-haiku-4-5-20251001",
				operation: "roi-recommendation",
				durationMs: 1500,
			},
		});
		const mockClient = { complete } as never;

		await generateRoiReportTexts(makeInput(), mockClient);

		expect(complete).toHaveBeenCalledTimes(1);
		const callArgs = complete.mock.calls[0][0];
		expect(callArgs.operation).toBe("roi-recommendation");
		expect(callArgs.maxTokens).toBe(2048);
	});

	it("schema validates valid response (executiveSummary, recommendations, outlook)", () => {
		const result = RoiReportTextsSchema.safeParse(VALID_ROI_TEXTS);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.executiveSummary).toBe(VALID_ROI_TEXTS.executiveSummary);
			expect(result.data.recommendations).toHaveLength(1);
			expect(result.data.outlook).toBe(VALID_ROI_TEXTS.outlook);
		}
	});

	it("handles invalid JSON gracefully (returns ok:false)", async () => {
		const complete = vi.fn().mockResolvedValue({
			text: "this is not valid JSON {{{",
			usage: {
				inputTokens: 600,
				outputTokens: 50,
				model: "claude-haiku-4-5-20251001",
				operation: "roi-recommendation",
				durationMs: 500,
			},
		});
		const mockClient = { complete } as never;

		const result = await generateRoiReportTexts(makeInput(), mockClient);

		expect(result.ok).toBe(false);
	});

	it("includes score delta data in the prompt", async () => {
		const complete = vi.fn().mockResolvedValue({
			text: JSON.stringify(VALID_ROI_TEXTS),
			usage: {
				inputTokens: 600,
				outputTokens: 400,
				model: "claude-haiku-4-5-20251001",
				operation: "roi-recommendation",
				durationMs: 1500,
			},
		});
		const mockClient = { complete } as never;

		const input = makeInput({ scoreDelta: 32, baselineScore: 40, currentScore: 72 });
		await generateRoiReportTexts(input, mockClient);

		const userMessage = complete.mock.calls[0][0].userMessage;
		expect(userMessage).toContain('"scoreDelta": 32');
		expect(userMessage).toContain('"baselineScore": 40');
		expect(userMessage).toContain('"currentScore": 72');
	});
});
