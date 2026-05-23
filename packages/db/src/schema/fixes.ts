import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { scans } from "./scans";

// ─── Enums (text + const arrays; repo convention, no pgEnum) ─────────────
// Pattern verified against scans.ts:23,39 and profiles.ts:11.

export const FIX_TYPES = ["llms_txt", "json_ld", "agents_md"] as const;
export type FixType = (typeof FIX_TYPES)[number];

export const FIX_STATUSES = ["draft", "approved", "deployed", "failed"] as const;
export type FixStatus = (typeof FIX_STATUSES)[number];

export const DEPLOYMENT_STATUSES = [
	"pending",
	"in_progress",
	"succeeded",
	"failed",
	"rolled_back",
] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const CMS_TYPES = ["wordpress", "webflow", "shopify"] as const;
export type CmsType = (typeof CMS_TYPES)[number];

export const VALIDATION_STATUSES = ["pass", "fail", "partial"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

// ─── generated_fixes ─────────────────────────────────────────────────────
// One row per (scan, fix_type, version). New generation = MAX(version)+1.
// Soft-deletable. Note: the issue AC names this column `brand_id`; we use
// `user_id` to match the rest of the codebase (scans.userId etc.). The
// deviation is documented in CONTEXT.md (2026-04-07) and the PR body.

export const generatedFixes = pgTable(
	"generated_fixes",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		scanId: uuid("scan_id")
			.references(() => scans.id, { onDelete: "cascade" })
			.notNull(),

		userId: uuid("user_id")
			.references(() => profiles.id, { onDelete: "cascade" })
			.notNull(),

		fixType: text("fix_type", { enum: FIX_TYPES }).notNull(),

		// Generated artifact body. text (not jsonb) — uniform across markdown
		// and JSON-LD; lets us hash + diff + version-control as opaque blobs.
		content: text("content").notNull(),

		// sha256 hex for dedupe (skip if same content was already generated).
		contentHash: text("content_hash").notNull(),

		// Monotonic per (scan_id, fix_type), see uniqueIndex below.
		version: integer("version").notNull().default(1),

		status: text("status", { enum: FIX_STATUSES }).notNull().default("draft"),

		// Provenance for #309 billing + #312 test snapshots. Kept in JSONB to
		// avoid premature column promotion (see decision D12 in masterplan).
		// `inputHash` is the #233 idempotency short-circuit key — JSONB-only
		// type widening, no SQL migration.
		generationMetadata: jsonb("generation_metadata").$type<{
			model?: string;
			promptVersion?: string;
			inputTokens?: number;
			outputTokens?: number;
			costCents?: number;
			durationMs?: number;
			inputHash?: string;
		}>(),

		// NOTE: `approved_by` / `approved_at` were intentionally NOT included.
		// See decision D21 in the #223 masterplan: the approval workflow is
		// unscoped, has no in-scope consumer, and a second profiles FK would
		// force inverse-relation boilerplate (Drizzle "ambiguous relation").
		// Re-add in a follow-up issue when the approval UI lands.

		errorMessage: text("error_message"),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("uq_generated_fixes_scan_type_version")
			.on(table.scanId, table.fixType, table.version)
			.where(sql`${table.deletedAt} IS NULL`),
		index("idx_generated_fixes_scan").on(table.scanId),
		index("idx_generated_fixes_user").on(table.userId),
		index("idx_generated_fixes_fix_type").on(table.fixType),
		index("idx_generated_fixes_status").on(table.status).where(sql`${table.status} != 'deployed'`),
		index("idx_generated_fixes_user_type_created")
			.on(table.userId, table.fixType, table.createdAt.desc())
			.where(sql`${table.deletedAt} IS NULL`),
		index("idx_generated_fixes_content_hash").on(table.contentHash),
	],
);

// ─── cms_connections ─────────────────────────────────────────────────────
// Soft-deletable. Disconnect: UPDATE deletedAt=NOW(), isActive=false,
// encryptedCredentials=NULL (wipe secret material; preserve row for FK).

export const cmsConnections = pgTable(
	"cms_connections",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		userId: uuid("user_id")
			.references(() => profiles.id, { onDelete: "cascade" })
			.notNull(),

		cmsType: text("cms_type", { enum: CMS_TYPES }).notNull(),
		siteUrl: text("site_url").notNull(),
		label: text("label"),

		// AES-256-GCM JSON envelope; nullable so soft-delete can wipe secret.
		encryptedCredentials: text("encrypted_credentials"),

		isActive: boolean("is_active").notNull().default(true),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_cms_connections_user").on(table.userId),
		index("idx_cms_connections_user_active")
			.on(table.userId, table.cmsType)
			.where(sql`${table.isActive} = true AND ${table.deletedAt} IS NULL`),
		uniqueIndex("uq_cms_connections_active_per_site")
			.on(table.userId, table.cmsType, table.siteUrl)
			.where(sql`${table.deletedAt} IS NULL`),
	],
);

// ─── deployment_attempts ─────────────────────────────────────────────────
// Immutable audit. RESTRICT on cms_connection_id preserves audit integrity.

export const deploymentAttempts = pgTable(
	"deployment_attempts",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		fixId: uuid("fix_id")
			.references(() => generatedFixes.id, { onDelete: "cascade" })
			.notNull(),

		cmsConnectionId: uuid("cms_connection_id")
			.references(() => cmsConnections.id, { onDelete: "restrict" })
			.notNull(),

		status: text("status", { enum: DEPLOYMENT_STATUSES }).notNull().default("pending"),

		attemptNumber: integer("attempt_number").notNull().default(1),

		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),

		errorMessage: text("error_message"),
		// NETWORK / AUTH / CMS_4XX / CMS_5XX / VALIDATION
		errorCode: text("error_code"),

		// Typed via RollbackPayload union in @beacon/shared/types.
		rollbackData: jsonb("rollback_data"),

		// BullMQ idempotency key for safe retries.
		idempotencyKey: text("idempotency_key"),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		index("idx_deployment_attempts_fix").on(table.fixId, table.startedAt.desc()),
		index("idx_deployment_attempts_cms").on(table.cmsConnectionId),
		index("idx_deployment_attempts_status").on(table.status),
		index("idx_deployment_attempts_active")
			.on(table.startedAt)
			.where(sql`${table.status} IN ('pending', 'in_progress')`),
		uniqueIndex("uq_deployment_attempts_idempotency")
			.on(table.idempotencyKey)
			.where(sql`${table.idempotencyKey} IS NOT NULL`),
	],
);

// ─── fix_validations ─────────────────────────────────────────────────────
// Immutable audit. scanId nullable + SET NULL: validation re-scan TTLs.

export const fixValidations = pgTable(
	"fix_validations",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		deploymentId: uuid("deployment_id")
			.references(() => deploymentAttempts.id, { onDelete: "cascade" })
			.notNull(),

		// SEMANTIC (decision D17 in masterplan): this scan_id points to the
		// *post-deployment validation re-scan* — i.e. a NEW `scans` row
		// created AFTER the fix is deployed, used to verify the fix actually
		// worked end-to-end. It is NOT the original scan that triggered fix
		// generation (that one is reachable via deployment_attempt → fix →
		// fix.scan_id). Nullable + ON DELETE SET NULL because the re-scan
		// inherits the same 30-day TTL as any other scan, but `results`
		// JSONB is self-contained so the validation row survives the TTL.
		scanId: uuid("scan_id").references(() => scans.id, { onDelete: "set null" }),

		status: text("status", { enum: VALIDATION_STATUSES }).notNull(),

		results: jsonb("results")
			.$type<{
				checksRun: string[];
				checksPassed: string[];
				checksFailed: string[];
				scoreDelta?: number;
				details?: Record<string, unknown>;
			}>()
			.notNull(),

		validatedAt: timestamp("validated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_fix_validations_deployment").on(table.deploymentId),
		index("idx_fix_validations_scan").on(table.scanId),
		index("idx_fix_validations_status").on(table.status).where(sql`${table.status} != 'pass'`),
		index("idx_fix_validations_validated").on(table.validatedAt.desc()),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────

export const generatedFixesRelations = relations(generatedFixes, ({ one, many }) => ({
	scan: one(scans, { fields: [generatedFixes.scanId], references: [scans.id] }),
	user: one(profiles, {
		fields: [generatedFixes.userId],
		references: [profiles.id],
	}),
	deployments: many(deploymentAttempts),
}));

// NOTE on profiles inverse: per decision D21, `generated_fixes` has only ONE
// FK to `profiles` (`user_id`), so no `relationName` disambiguation is needed
// and no inverse `generatedFixesAsUser`/`AsApprover` declarations are required
// in `relations.ts`. If a future PR adds the approval columns, the matching
// `relationName` pair MUST be added on BOTH sides simultaneously, otherwise
// Drizzle will throw "ambiguous relation" at first query traversal.

export const cmsConnectionsRelations = relations(cmsConnections, ({ one, many }) => ({
	user: one(profiles, { fields: [cmsConnections.userId], references: [profiles.id] }),
	deployments: many(deploymentAttempts),
}));

export const deploymentAttemptsRelations = relations(deploymentAttempts, ({ one, many }) => ({
	fix: one(generatedFixes, {
		fields: [deploymentAttempts.fixId],
		references: [generatedFixes.id],
	}),
	cmsConnection: one(cmsConnections, {
		fields: [deploymentAttempts.cmsConnectionId],
		references: [cmsConnections.id],
	}),
	validations: many(fixValidations),
}));

export const fixValidationsRelations = relations(fixValidations, ({ one }) => ({
	deployment: one(deploymentAttempts, {
		fields: [fixValidations.deploymentId],
		references: [deploymentAttempts.id],
	}),
	scan: one(scans, { fields: [fixValidations.scanId], references: [scans.id] }),
}));
