import disposableDomainsJson from "disposable-email-domains/index.json" with { type: "json" };
import { z } from "zod";
import { CHECK_IDS, FIX_GENERATOR_IDS, PLAN_NAMES } from "./types.js";

// The `disposable-email-domains` package ships its data as JSON via the
// package `main` field. Both Node ESM and Webpack accept the import-attributes
// syntax, so we use it here instead of relying on default-resolution which
// breaks on Node 22+.
const disposableDomains: string[] = disposableDomainsJson as string[];

export const UrlSchema = z
	.string()
	.trim()
	.max(2048, { message: "URL ist zu lang (max. 2048 Zeichen)" })
	.transform((val) => {
		if (!val.startsWith("http://") && !val.startsWith("https://")) {
			return `https://${val}`;
		}
		return val;
	})
	.pipe(z.string().url({ message: "Bitte geben Sie eine gültige URL ein" }));

export type ValidUrl = z.infer<typeof UrlSchema>;

export const UuidSchema = z.string().uuid({ message: "Ungültige ID" });

export type ValidUuid = z.infer<typeof UuidSchema>;

export const PlanNameSchema = z.enum(PLAN_NAMES, {
	errorMap: () => ({ message: "Ungültiger Plan" }),
});

export const CheckIdSchema = z.enum(CHECK_IDS, {
	errorMap: () => ({ message: "Ungültiger Check" }),
});

export const FixGeneratorIdSchema = z.enum(FIX_GENERATOR_IDS, {
	errorMap: () => ({ message: "Dieser Check unterstützt keine Fix-Generierung" }),
});

export const ScanRequestSchema = z.object({ url: UrlSchema });

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const FixRequestSchema = z.object({
	scanId: UuidSchema,
	checkId: FixGeneratorIdSchema,
	accessToken: z.string().optional(),
});

export type FixRequest = z.infer<typeof FixRequestSchema>;

export const AnalyzeRequestSchemaWithAccess = z.object({
	scanId: UuidSchema,
	accessToken: z.string().optional(),
});

export const PaginationSchema = z.object({
	page: z.coerce.number().int().positive({ message: "Seite muss positiv sein" }).default(1),
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(100, { message: "Limit darf max. 100 sein" })
		.default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const AnalysisTypeSchema = z.enum(["semantic", "citation", "both"], {
	errorMap: () => ({ message: "Analysetyp muss 'semantic', 'citation' oder 'both' sein" }),
});

export const AnalyzeRequestSchema = z.object({
	scanId: UuidSchema,
	type: AnalysisTypeSchema,
	accessToken: z.string().optional(),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

const hexColor = (label: string) =>
	z.string().regex(/^#[0-9a-fA-F]{6}$/, `${label} muss ein gueltiger Hex-Farbcode sein`);

export const BrandingConfigSchema = z.object({
	agencyName: z.string().min(1, "Firmenname ist erforderlich").max(200),
	primaryColor: hexColor("Primaerfarbe"),
	secondaryColor: hexColor("Sekundaerfarbe").optional(),
	accentColor: hexColor("Akzentfarbe"),
	logoUrl: z.string().url("Logo-URL muss eine gueltige URL sein").optional(),
	footerText: z.string().max(500).optional(),
	introText: z.string().max(1000).optional(),
	contactName: z.string().max(200).optional(),
	contactEmail: z.string().email().max(200).optional(),
	contactPhone: z.string().max(50).optional(),
	contactWebsite: z.string().url().max(300).optional(),
});

export type BrandingConfigInput = z.infer<typeof BrandingConfigSchema>;

export const ReportRequestSchema = z.object({
	scanId: UuidSchema,
	regenerate: z.boolean().optional().default(false),
	accessToken: z.string().optional(),
	branding: z
		.object({
			agencyName: z.string().min(1).max(200),
			primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
			accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
			logoUrl: z.string().url().optional(),
			footerText: z.string().max(200).optional(),
			introText: z.string().max(1000).optional(),
		})
		.optional(),
});

export type ReportRequest = z.infer<typeof ReportRequestSchema>;

export const WaitlistSignupSchema = z.object({
	email: z
		.string()
		.trim()
		.email({ message: "Bitte geben Sie eine gueltige E-Mail-Adresse ein" })
		.max(255),
	companyName: z.string().trim().max(200).optional(),
	websiteUrl: z.string().trim().url().max(2048).optional(),
	source: z.string().trim().max(50).optional(),
});

export type WaitlistSignupRequest = z.infer<typeof WaitlistSignupSchema>;

export const ComparisonRequestSchema = z.object({
	url: UrlSchema,
	competitors: z.array(UrlSchema).min(1).max(3),
});

export type ComparisonRequest = z.infer<typeof ComparisonRequestSchema>;

// ── Monitoring Projects (v0.2 instance-scoped) ──────────────

export const MonitoringProjectCreateSchema = z.object({
	name: z.string().trim().min(1, "Name ist erforderlich").max(200),
	websiteUrl: UrlSchema,
	brandKeywords: z
		.array(z.string().trim().min(1).max(100))
		.min(1, "Mindestens ein Brand-Keyword ist erforderlich")
		.max(20, "Maximal 20 Brand-Keywords"),
	competitorKeywords: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
});

export type MonitoringProjectCreateInput = z.infer<typeof MonitoringProjectCreateSchema>;

// ── Monitoring Schedules ────────────────────────────────────

export const ScheduleFrequencySchema = z.enum(["hourly", "daily", "weekly"]);
export type ScheduleFrequency = z.infer<typeof ScheduleFrequencySchema>;

export const MonitoringScheduleCreateSchema = z.object({
	frequency: ScheduleFrequencySchema,
});

export type MonitoringScheduleCreateInput = z.infer<typeof MonitoringScheduleCreateSchema>;

export const MonitoringScheduleUpdateSchema = z
	.object({
		frequency: ScheduleFrequencySchema.optional(),
		enabled: z.boolean().optional(),
	})
	.refine((v) => v.frequency !== undefined || v.enabled !== undefined, {
		message: "Mindestens ein Feld muss gesetzt sein",
	});

export type MonitoringScheduleUpdateInput = z.infer<typeof MonitoringScheduleUpdateSchema>;

// ── Competitors ─────────────────────────────────────────────

export const CompetitorCreateSchema = z.object({
	name: z.string().trim().min(1, "Name ist erforderlich").max(200),
	domain: z
		.string()
		.trim()
		.max(255)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type CompetitorCreateInput = z.infer<typeof CompetitorCreateSchema>;

// ── Disposable Email Detection ──────────────────────────────

const DISPOSABLE_DOMAIN_SET = new Set<string>(disposableDomains);

export function isDisposableEmail(email: string): boolean {
	const domain = email.split("@")[1]?.toLowerCase();
	return domain ? DISPOSABLE_DOMAIN_SET.has(domain) : false;
}

export const SafeEmailSchema = z
	.string()
	.trim()
	.email({ message: "Bitte geben Sie eine gueltige E-Mail-Adresse ein" })
	.max(255)
	.refine((val) => !isDisposableEmail(val), {
		message: "Bitte verwenden Sie eine dauerhafte E-Mail-Adresse",
	});

export const UnlockRequestSchema = z.object({
	email: SafeEmailSchema,
	companyName: z.string().trim().max(200).optional(),
	utmSource: z.string().trim().max(100).optional(),
	utmMedium: z.string().trim().max(100).optional(),
	utmCampaign: z.string().trim().max(100).optional(),
});

export type UnlockRequest = z.infer<typeof UnlockRequestSchema>;

export const ConversionEventSchema = z.object({
	eventType: z.enum(["teaser_viewed", "email_entered", "report_viewed"]),
	metadata: z.record(z.unknown()).optional(),
});

export type ConversionEvent = z.infer<typeof ConversionEventSchema>;

export const SentimentOverrideSchema = z.object({
	sentiment: z.enum(["positive", "neutral", "negative"]),
});

export type SentimentOverrideRequest = z.infer<typeof SentimentOverrideSchema>;

// ── CMS Connection Schemas (#271) ──────────────────────────

export const CMS_TYPE_VALUES = ["wordpress", "webflow", "shopify"] as const;

export const CmsTypeSchema = z.enum(CMS_TYPE_VALUES, {
	errorMap: () => ({ message: "Ungültiger CMS-Typ" }),
});

export const CreateWordPressConnectionSchema = z.object({
	cmsType: z.literal("wordpress"),
	siteUrl: UrlSchema,
	label: z.string().trim().max(100).optional(),
	credentials: z.object({
		baseUrl: UrlSchema,
		username: z.string().trim().min(1, "Benutzername ist erforderlich").max(200),
		appPassword: z.string().trim().min(1, "Anwendungspasswort ist erforderlich").max(200),
	}),
});

export const CreateShopifyConnectionSchema = z.object({
	cmsType: z.literal("shopify"),
	siteUrl: z.string().trim().min(1, "Shop-Domain ist erforderlich").max(200),
	label: z.string().trim().max(100).optional(),
	credentials: z.object({
		shopDomain: z
			.string()
			.trim()
			.min(1, "Shop-Domain ist erforderlich")
			.max(200)
			.transform((val) => {
				// Normalize: ensure .myshopify.com suffix
				if (!val.includes(".")) return `${val}.myshopify.com`;
				return val;
			}),
		accessToken: z.string().trim().min(1, "API-Zugriffsschlüssel ist erforderlich").max(500),
		apiVersion: z
			.string()
			.trim()
			.regex(/^\d{4}-\d{2}$/, "API-Version muss im Format JJJJ-MM sein")
			.optional()
			.default("2024-10"),
	}),
});

export const CreateWebflowConnectionSchema = z.object({
	cmsType: z.literal("webflow"),
	siteUrl: UrlSchema,
	label: z.string().trim().max(100).optional(),
	credentials: z.object({
		siteId: z.string().trim().min(1, "Site-ID ist erforderlich").max(100),
		apiToken: z.string().trim().min(1, "API-Token ist erforderlich").max(500),
	}),
});

export const CreateCmsConnectionSchema = z.discriminatedUnion("cmsType", [
	CreateWordPressConnectionSchema,
	CreateShopifyConnectionSchema,
	CreateWebflowConnectionSchema,
]);

export type CreateCmsConnectionRequest = z.infer<typeof CreateCmsConnectionSchema>;

// ── Deploy Request (#280) ─────────────────────────────────────

export const DeployRequestSchema = z.object({
	fixId: UuidSchema,
	cmsConnectionId: UuidSchema,
});

export type DeployRequest = z.infer<typeof DeployRequestSchema>;
