import { describe, expect, it } from "vitest";
import {
	CitationAnalysisSchema,
	DimensionSchema,
	GeneratedFixSchema,
	ScoreSchema,
	SemanticAnalysisSchema,
	parseAiOutput,
} from "../schemas.js";

// ── Fixtures ────────────────────────────────────────────────

const VALID_DIMENSION = { score: 75, assessment: "Gute Struktur" };

const VALID_SEMANTIC = {
	overallScore: 82,
	clarity: { score: 80, assessment: "Klar formuliert" },
	structure: { score: 85, assessment: "Gute Struktur" },
	factDensity: { score: 78, assessment: "Ausreichend Fakten" },
	topicFocus: { score: 90, assessment: "Fokussiert" },
	uniqueness: { score: 77, assessment: "Originell" },
	summary: "Insgesamt guter Inhalt mit Verbesserungspotenzial.",
	improvements: ["Mehr Beispiele", "Kürzere Sätze"],
};

const VALID_CITATION = {
	overallScore: 70,
	quotability: { score: 65, assessment: "Zitierbar" },
	authority: { score: 72, assessment: "Autorität vorhanden" },
	specificity: { score: 80, assessment: "Spezifisch genug" },
	freshness: { score: 60, assessment: "Aktuell" },
	attribution: { score: 73, assessment: "Korrekt attribuiert" },
	summary: "Solide Zitierfaehigkeit.",
	improvements: ["Mehr Quellenangaben"],
};

// ── ScoreSchema ─────────────────────────────────────────────

describe("ScoreSchema", () => {
	it("accepts valid scores (0, 50, 100)", () => {
		expect(ScoreSchema.safeParse(0).success).toBe(true);
		expect(ScoreSchema.safeParse(50).success).toBe(true);
		expect(ScoreSchema.safeParse(100).success).toBe(true);
	});

	it("rejects negative numbers", () => {
		const result = ScoreSchema.safeParse(-1);
		expect(result.success).toBe(false);
	});

	it("rejects > 100", () => {
		const result = ScoreSchema.safeParse(101);
		expect(result.success).toBe(false);
	});
});

// ── DimensionSchema ─────────────────────────────────────────

describe("DimensionSchema", () => {
	it("accepts valid dimension", () => {
		const result = DimensionSchema.safeParse(VALID_DIMENSION);
		expect(result.success).toBe(true);
	});

	it("rejects empty assessment", () => {
		const result = DimensionSchema.safeParse({ score: 75, assessment: "" });
		expect(result.success).toBe(false);
	});

	it("rejects score out of range", () => {
		const result = DimensionSchema.safeParse({ score: 150, assessment: "Test" });
		expect(result.success).toBe(false);
	});
});

// ── SemanticAnalysisSchema ──────────────────────────────────

describe("SemanticAnalysisSchema", () => {
	it("accepts complete valid object", () => {
		const result = SemanticAnalysisSchema.safeParse(VALID_SEMANTIC);
		expect(result.success).toBe(true);
	});

	it("rejects missing dimensions", () => {
		const { clarity: _, ...incomplete } = VALID_SEMANTIC;
		const result = SemanticAnalysisSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});

	it("rejects too many improvements (6 items)", () => {
		const tooMany = {
			...VALID_SEMANTIC,
			improvements: ["A", "B", "C", "D", "E", "F"],
		};
		const result = SemanticAnalysisSchema.safeParse(tooMany);
		expect(result.success).toBe(false);
	});
});

// ── CitationAnalysisSchema ──────────────────────────────────

describe("CitationAnalysisSchema", () => {
	it("accepts complete valid object", () => {
		const result = CitationAnalysisSchema.safeParse(VALID_CITATION);
		expect(result.success).toBe(true);
	});

	it("rejects invalid dimension scores", () => {
		const invalid = {
			...VALID_CITATION,
			quotability: { score: -5, assessment: "Schlecht" },
		};
		const result = CitationAnalysisSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

// ── GeneratedFixSchema ──────────────────────────────────────

describe("GeneratedFixSchema", () => {
	it("accepts valid fix", () => {
		const result = GeneratedFixSchema.safeParse({
			checkId: "llms-txt",
			content: "# Title",
			filename: "llms.txt",
			method: "ai-generated",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid checkId", () => {
		const result = GeneratedFixSchema.safeParse({
			checkId: "invalid-check",
			content: "# Title",
			filename: "llms.txt",
			method: "ai-generated",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe("Ungültiger Fix-Generator Check");
		}
	});

	it("rejects empty content", () => {
		const result = GeneratedFixSchema.safeParse({
			checkId: "llms-txt",
			content: "",
			filename: "llms.txt",
			method: "ai-generated",
		});
		expect(result.success).toBe(false);
	});
});

// ── parseAiOutput ───────────────────────────────────────────

describe("parseAiOutput", () => {
	it("returns success with valid data", () => {
		const result = parseAiOutput(ScoreSchema, 50);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(50);
		}
	});

	it("returns failure with error string and issues array", () => {
		const result = parseAiOutput(DimensionSchema, { score: -1, assessment: "" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(typeof result.error).toBe("string");
			expect(Array.isArray(result.issues)).toBe(true);
			expect(result.issues.length).toBeGreaterThan(0);
		}
	});

	it("error string contains path information", () => {
		const result = parseAiOutput(SemanticAnalysisSchema, {
			...VALID_SEMANTIC,
			clarity: { score: -1, assessment: "x" },
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("clarity.score");
		}
	});
});
