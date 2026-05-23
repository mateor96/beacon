import { CHECK_IDS, FIX_GENERATOR_IDS } from "@beacon/shared";
import { type ZodIssue, type ZodSchema, z } from "zod";

// ── Score & Dimension ────────────────────────────────────────

export const ScoreSchema = z
	.number()
	.int({ message: "Score muss eine ganze Zahl sein" })
	.min(0, { message: "Score darf nicht kleiner als 0 sein" })
	.max(100, { message: "Score darf nicht groesser als 100 sein" });

export const DimensionSchema = z.object({
	score: ScoreSchema,
	assessment: z
		.string()
		.min(1, { message: "Bewertung darf nicht leer sein" })
		.max(500, { message: "Bewertung darf max. 500 Zeichen lang sein" }),
});

// ── Semantic Analysis ────────────────────────────────────────

export const SemanticAnalysisSchema = z.object({
	overallScore: ScoreSchema,
	clarity: DimensionSchema,
	structure: DimensionSchema,
	factDensity: DimensionSchema,
	topicFocus: DimensionSchema,
	uniqueness: DimensionSchema,
	summary: z
		.string()
		.min(1, { message: "Zusammenfassung darf nicht leer sein" })
		.max(1000, { message: "Zusammenfassung darf max. 1000 Zeichen lang sein" }),
	improvements: z
		.array(z.string().min(1, { message: "Verbesserungsvorschlag darf nicht leer sein" }))
		.max(5, { message: "Maximal 5 Verbesserungsvorschlaege" }),
});

export type ValidatedSemanticAnalysis = z.infer<typeof SemanticAnalysisSchema>;

// ── Citation Analysis ────────────────────────────────────────

export const CitationAnalysisSchema = z.object({
	overallScore: ScoreSchema,
	quotability: DimensionSchema,
	authority: DimensionSchema,
	specificity: DimensionSchema,
	freshness: DimensionSchema,
	attribution: DimensionSchema,
	summary: z
		.string()
		.min(1, { message: "Zusammenfassung darf nicht leer sein" })
		.max(1000, { message: "Zusammenfassung darf max. 1000 Zeichen lang sein" }),
	improvements: z
		.array(z.string().min(1, { message: "Verbesserungsvorschlag darf nicht leer sein" }))
		.max(5, { message: "Maximal 5 Verbesserungsvorschlaege" }),
});

export type ValidatedCitationAnalysis = z.infer<typeof CitationAnalysisSchema>;

// ── Generated Fix ────────────────────────────────────────────

export const GeneratedFixSchema = z.object({
	checkId: z.enum(FIX_GENERATOR_IDS, {
		errorMap: () => ({ message: "Ungültiger Fix-Generator Check" }),
	}),
	content: z.string().min(1, { message: "Fix-Inhalt darf nicht leer sein" }),
	filename: z.string().min(1, { message: "Dateiname darf nicht leer sein" }),
	method: z.enum(["rule-based", "ai-generated", "hybrid"], {
		errorMap: () => ({ message: "Ungültige Methode" }),
	}),
});

export type ValidatedGeneratedFix = z.infer<typeof GeneratedFixSchema>;

// ── Report Texts ────────────────────────────────────────────

const CheckSummarySchema = z.object({
	title: z.string().min(1, { message: "Titel darf nicht leer sein" }).max(200),
	assessment: z.string().min(1, { message: "Bewertung darf nicht leer sein" }).max(1000),
	recommendation: z.string().min(1, { message: "Empfehlung darf nicht leer sein" }).max(500),
});

const CategoryAssessmentSchema = z.object({
	title: z.string().min(1, { message: "Titel darf nicht leer sein" }).max(200),
	summary: z.string().min(1, { message: "Zusammenfassung darf nicht leer sein" }).max(1000),
	score: ScoreSchema,
});

const RecommendationSchema = z.object({
	priority: z.number().int().min(1).max(10),
	title: z.string().min(1, { message: "Titel darf nicht leer sein" }).max(200),
	description: z.string().min(1, { message: "Beschreibung darf nicht leer sein" }).max(500),
	impact: z.enum(["high", "medium", "low"], {
		errorMap: () => ({ message: "Impact muss high, medium oder low sein" }),
	}),
});

export const ReportTextsSchema = z.object({
	executiveSummary: z
		.string()
		.min(1, { message: "Executive Summary darf nicht leer sein" })
		.max(2000, { message: "Executive Summary darf max. 2000 Zeichen lang sein" }),
	checkSummaries: z.record(z.enum(CHECK_IDS), CheckSummarySchema),
	categoryAssessments: z.object({
		readability: CategoryAssessmentSchema,
		interactivity: CategoryAssessmentSchema,
		transactional: CategoryAssessmentSchema.optional(),
	}),
	recommendations: z
		.array(RecommendationSchema)
		.min(1, { message: "Mindestens eine Empfehlung erforderlich" })
		.max(10, { message: "Maximal 10 Empfehlungen" }),
	conclusion: z
		.string()
		.min(1, { message: "Fazit darf nicht leer sein" })
		.max(2000, { message: "Fazit darf max. 2000 Zeichen lang sein" }),
});

export type ValidatedReportTexts = z.infer<typeof ReportTextsSchema>;

// ── ROI Report Texts (#281) ─────────────────────────────────

const RoiRecommendationSchema = z.object({
	priority: z.number().int().min(1).max(5),
	title: z.string().min(1).max(200),
	description: z.string().min(1).max(500),
	impact: z.enum(["high", "medium", "low"]),
});

export const RoiReportTextsSchema = z.object({
	executiveSummary: z
		.string()
		.min(1, { message: "Zusammenfassung darf nicht leer sein" })
		.max(2000),
	recommendations: z
		.array(RoiRecommendationSchema)
		.min(1, { message: "Mindestens eine Empfehlung erforderlich" })
		.max(5),
	outlook: z.string().min(1, { message: "Ausblick darf nicht leer sein" }).max(2000),
});

export type ValidatedRoiReportTexts = z.infer<typeof RoiReportTextsSchema>;

// ── Parse Helper ─────────────────────────────────────────────

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; error: string; issues: ZodIssue[] };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function parseAiOutput<T>(schema: ZodSchema<T>, data: unknown): ParseResult<T> {
	const result = schema.safeParse(data);

	if (result.success) {
		return { success: true, data: result.data };
	}

	const messages = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);

	return {
		success: false,
		error: `AI-Ausgabe Validierung fehlgeschlagen: ${messages.join("; ")}`,
		issues: result.error.issues,
	};
}
