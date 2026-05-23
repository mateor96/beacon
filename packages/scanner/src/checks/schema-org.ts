import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP } from "@beacon/shared";
import type { HTMLElement } from "node-html-parser";
import { defaultRegistry } from "../registry.js";

// ── Type classifications ────────────────────────────────────

const PRIMARY_TYPES = [
	"Organization",
	"WebSite",
	"Article",
	"NewsArticle",
	"BlogPosting",
	"Product",
	"FAQPage",
	"LocalBusiness",
] as const;

const SECONDARY_TYPES = [
	"BreadcrumbList",
	"WebPage",
	"Person",
	"HowTo",
	"Event",
	"Service",
] as const;

// ── Required properties ─────────────────────────────────────

const REQUIRED_PROPERTIES: Record<string, string[]> = {
	Organization: ["name", "url"],
	WebSite: ["name", "url"],
	Article: ["headline"],
	NewsArticle: ["headline"],
	BlogPosting: ["headline"],
	Product: ["name"],
	FAQPage: ["mainEntity"],
	BreadcrumbList: ["itemListElement"],
	LocalBusiness: ["name", "address"],
	HowTo: ["name", "step"],
	Event: ["name", "startDate"],
	Person: ["name"],
	Service: ["name"],
	WebPage: ["name"],
};

// ── Scoring weights ─────────────────────────────────────────

const POINTS = {
	exists: 10,
	validJson: 15,
	hasType: 10,
	relevantTypes: 25,
	requiredProperties: 25,
	multipleSchemas: 10,
	noErrors: 5,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

// ── Interfaces ──────────────────────────────────────────────

interface SchemaObject {
	type: string;
	types: string[];
	properties: Record<string, unknown>;
	hasContext: boolean;
}

interface ParsedSchemaOrg {
	rawBlockCount: number;
	validBlocks: unknown[];
	invalidBlockCount: number;
	schemas: SchemaObject[];
	foundTypes: string[];
	relevantTypes: string[];
	hasPrimaryType: boolean;
}

// ── Helpers ─────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

const ALL_RELEVANT_TYPES = new Set<string>([...PRIMARY_TYPES, ...SECONDARY_TYPES]);

const PRIMARY_TYPE_SET = new Set<string>(PRIMARY_TYPES);

function resolveTypes(typeValue: unknown): string[] {
	if (typeof typeValue === "string") return [typeValue];
	if (Array.isArray(typeValue)) return typeValue.filter((t): t is string => typeof t === "string");
	return [];
}

function normalizeSchema(obj: Record<string, unknown>, parentHasContext: boolean): SchemaObject {
	const types = resolveTypes(obj["@type"]);
	const hasContext = "@context" in obj || parentHasContext;
	return {
		type: types[0] ?? "",
		types,
		properties: obj,
		hasContext,
	};
}

// ── Parser ──────────────────────────────────────────────────

function parseSchemaOrg(parsedHtml: unknown): ParsedSchemaOrg {
	const root = parsedHtml as HTMLElement;
	const scriptTags = root.querySelectorAll('script[type="application/ld+json"]');

	const rawBlockCount = scriptTags.length;
	const validBlocks: unknown[] = [];
	let invalidBlockCount = 0;
	const schemas: SchemaObject[] = [];

	for (const tag of scriptTags) {
		const text = tag.textContent?.trim();
		if (!text) {
			invalidBlockCount++;
			continue;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			invalidBlockCount++;
			continue;
		}

		validBlocks.push(parsed);

		// Normalize parsed value into schema objects
		if (Array.isArray(parsed)) {
			for (const item of parsed) {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					schemas.push(normalizeSchema(item as Record<string, unknown>, false));
				}
			}
		} else if (parsed && typeof parsed === "object") {
			const obj = parsed as Record<string, unknown>;
			if (Array.isArray(obj["@graph"])) {
				const parentHasContext = "@context" in obj;
				for (const item of obj["@graph"] as unknown[]) {
					if (item && typeof item === "object" && !Array.isArray(item)) {
						schemas.push(normalizeSchema(item as Record<string, unknown>, parentHasContext));
					}
				}
			} else {
				schemas.push(normalizeSchema(obj, false));
			}
		}
	}

	// Deduplicate found types
	const typeSet = new Set<string>();
	for (const schema of schemas) {
		for (const t of schema.types) {
			typeSet.add(t);
		}
	}
	const foundTypes = [...typeSet];
	const relevantTypes = foundTypes.filter((t) => ALL_RELEVANT_TYPES.has(t));
	const hasPrimaryType = relevantTypes.some((t) => PRIMARY_TYPE_SET.has(t));

	return {
		rawBlockCount,
		validBlocks,
		invalidBlockCount,
		schemas,
		foundTypes,
		relevantTypes,
		hasPrimaryType,
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(parsed: ParsedSchemaOrg): {
	score: number;
	issues: ScanCheckIssue[];
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;

	// exists
	if (parsed.rawBlockCount > 0) {
		score += POINTS.exists;
	}

	// validJson
	if (parsed.invalidBlockCount === 0 && parsed.validBlocks.length > 0) {
		score += POINTS.validJson;
	} else if (parsed.validBlocks.length > 0 && parsed.invalidBlockCount > 0) {
		score += 7; // partial
		addIssue(
			issues,
			`${parsed.invalidBlockCount} von ${parsed.rawBlockCount} Strukturierte-Daten-Blöcken enthalten Fehler`,
			"important",
		);
	} else if (parsed.rawBlockCount > 0 && parsed.validBlocks.length === 0) {
		if (parsed.rawBlockCount === 1) {
			addIssue(issues, "Strukturierte-Daten-Block 1 enthält ungültiges Datenformat", "important");
		} else {
			addIssue(
				issues,
				"Alle Strukturierte-Daten-Blöcke enthalten ungültiges Datenformat — KI-Systeme ignorieren fehlerhafte Daten",
				"important",
			);
		}
	}

	// hasType
	const hasAnyType = parsed.schemas.some((s) => s.types.length > 0);
	if (hasAnyType) {
		score += POINTS.hasType;
	} else if (parsed.schemas.length > 0) {
		addIssue(
			issues,
			"Keine Inhaltstyp-Angabe (@type) gefunden — KI-Systeme können den Inhaltstyp nicht erkennen",
			"important",
		);
	}

	// relevantTypes
	if (parsed.hasPrimaryType) {
		score += POINTS.relevantTypes;
	} else if (parsed.relevantTypes.length > 0) {
		score += 15; // secondary only
	} else if (hasAnyType) {
		addIssue(
			issues,
			"Keine KI-relevanten Inhaltstypen gefunden — verwenden Sie Organization, Article, FAQPage oder Product für bessere KI-Sichtbarkeit",
			"important",
		);
	}

	// requiredProperties
	let totalRequired = 0;
	let totalPresent = 0;
	const typeCompleteness: Record<
		string,
		{ required: string[]; present: string[]; missing: string[] }
	> = {};

	for (const schema of parsed.schemas) {
		for (const t of schema.types) {
			const required = REQUIRED_PROPERTIES[t];
			if (!required) continue;
			totalRequired += required.length;
			const present: string[] = [];
			const missing: string[] = [];
			for (const prop of required) {
				if (prop in schema.properties && schema.properties[prop] != null) {
					present.push(prop);
					totalPresent++;
				} else {
					missing.push(prop);
				}
			}
			typeCompleteness[t] = { required, present, missing };
			if (missing.length > 0) {
				addIssue(issues, `${t}-Schema unvollständig (fehlend: ${missing.join(", ")})`, "important");
			}
		}
	}

	let requiredScore =
		totalRequired > 0 ? Math.floor((POINTS.requiredProperties * totalPresent) / totalRequired) : 0;
	// Cap at 15 if only secondary types
	if (!parsed.hasPrimaryType && parsed.relevantTypes.length > 0) {
		requiredScore = Math.min(requiredScore, 15);
	}
	score += requiredScore;

	// multipleSchemas
	const distinctRelevantTypes = new Set(
		parsed.schemas.flatMap((s) => s.types.filter((t) => ALL_RELEVANT_TYPES.has(t))),
	);
	if (distinctRelevantTypes.size >= 3) {
		score += POINTS.multipleSchemas;
	} else if (distinctRelevantTypes.size === 2) {
		score += 5;
	} else if (distinctRelevantTypes.size === 1) {
		addIssue(
			issues,
			"Nur ein Inhaltstyp gefunden — mehrere Typen wie Organization + FAQPage verbessern die KI-Abdeckung",
			"nice-to-have",
		);
	}

	// noErrors
	const hasEmptySchema = parsed.schemas.some((s) => {
		const keys = Object.keys(s.properties).filter((k) => k !== "@context" && k !== "@type");
		return keys.length === 0;
	});
	const hasNoContext = parsed.schemas.length > 0 && !parsed.schemas.some((s) => s.hasContext);
	// Duplicate @type check
	const typeCounts = new Map<string, number>();
	for (const schema of parsed.schemas) {
		for (const t of schema.types) {
			typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
		}
	}
	const duplicateTypes = [...typeCounts.entries()].filter(([, count]) => count > 1);

	if (hasEmptySchema) {
		addIssue(
			issues,
			"Strukturierte-Daten-Block ist leer — strukturierte Daten ohne Inhalt sind für KI-Systeme nicht verwertbar",
			"important",
		);
	}
	if (hasNoContext) {
		addIssue(
			issues,
			"Keine Schema-Referenz (@context) gefunden — für vollständige Kompatibilität sollte https://schema.org als Kontext angegeben werden",
			"nice-to-have",
		);
	}
	for (const [type, count] of duplicateTypes) {
		addIssue(
			issues,
			`Doppelte Inhaltstypen gefunden (${type} ${count}x) — konsolidieren Sie mehrfache Definitionen`,
			"nice-to-have",
		);
	}

	if (!hasEmptySchema && !hasNoContext && duplicateTypes.length === 0) {
		score += POINTS.noErrors;
	}

	return { score: Math.min(100, score), issues, _typeCompleteness: typeCompleteness } as {
		score: number;
		issues: ScanCheckIssue[];
		_typeCompleteness?: Record<
			string,
			{ required: string[]; present: string[]; missing: string[] }
		>;
	};
}

// ── Check implementation ────────────────────────────────────

const META = CHECK_METADATA_MAP["schema-org"];

const schemaOrgCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parseSchemaOrg(ctx.parsedHtml);

		// No JSON-LD found
		if (parsed.rawBlockCount === 0) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: "Kein Schema.org JSON-LD gefunden oder Daten sind fehlerhaft",
				issues: [
					{
						message:
							"Keine Strukturierten Daten gefunden — KI-Systeme können Ihre Inhalte nicht strukturiert erfassen",
						severity: "important",
					},
				],
			};
		}

		// All blocks invalid
		if (parsed.validBlocks.length === 0) {
			const issues: ScanCheckIssue[] = [];
			if (parsed.rawBlockCount === 1) {
				addIssue(issues, "Strukturierte-Daten-Block 1 enthält ungültiges Datenformat", "important");
			} else {
				addIssue(
					issues,
					"Alle Strukturierte-Daten-Blöcke enthalten ungültiges Datenformat — KI-Systeme ignorieren fehlerhafte Daten",
					"important",
				);
			}
			return {
				...META,
				status: "fail",
				score: POINTS.exists,
				summary: "Kein Schema.org JSON-LD gefunden oder Daten sind fehlerhaft",
				issues,
			};
		}

		// Calculate score
		const result = calculateScore(parsed) as {
			score: number;
			issues: ScanCheckIssue[];
			_typeCompleteness?: Record<
				string,
				{ required: string[]; present: string[]; missing: string[] }
			>;
		};

		// Status mapping
		let status: "pass" | "warn" | "fail";
		if (result.score < STATUS_THRESHOLD_FAIL) {
			status = "fail";
		} else if (result.score < STATUS_THRESHOLD_PASS) {
			status = "warn";
		} else {
			status = "pass";
		}

		const summaryMap = {
			pass: "Schema.org JSON-LD ist gut strukturiert und enthält KI-relevante Typen",
			warn: "Schema.org JSON-LD vorhanden, aber unvollständig — wichtige Typen oder Eigenschaften fehlen",
			fail: "Kein Schema.org JSON-LD gefunden oder Daten sind fehlerhaft",
		};

		return {
			...META,
			status,
			score: result.score,
			summary: summaryMap[status],
			issues: result.issues,
			details: {
				jsonLdBlockCount: parsed.rawBlockCount,
				validBlockCount: parsed.validBlocks.length,
				errorBlockCount: parsed.invalidBlockCount,
				typesFound: parsed.foundTypes,
				aiRelevantTypes: parsed.relevantTypes,
				hasContext: parsed.schemas.some((s) => s.hasContext),
				typeCompleteness: result._typeCompleteness ?? {},
			},
		};
	},
};

defaultRegistry.register(schemaOrgCheck);

export default schemaOrgCheck;
export {
	REQUIRED_PROPERTIES,
	parseSchemaOrg,
	calculateScore,
	type ParsedSchemaOrg,
	type SchemaObject,
};
