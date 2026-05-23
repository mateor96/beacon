import {
	cmsCredentialsAad,
	decryptCmsCredentials,
	encryptCmsCredentials,
} from "@beacon/shared/crypto-aes-gcm";
import type { CmsCredentialsPlaintext } from "@beacon/shared/types";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	type CmsType,
	type DeploymentStatus,
	type FixStatus,
	type FixType,
	type ValidationStatus,
	cmsConnections,
	deploymentAttempts,
	fixValidations,
	generatedFixes,
} from "../schema/fixes";

// ─── generated_fixes ─────────────────────────────────────────────────────
// Unblocks: #271 (fix worker), #256 (deploy queue), #280/#284 (UI listings)

export interface CreateGeneratedFixInput {
	scanId: string;
	userId: string;
	fixType: FixType;
	content: string;
	contentHash: string;
	generationMetadata?: typeof generatedFixes.$inferInsert.generationMetadata;
}

const CREATE_GENERATED_FIX_MAX_RETRIES = 5;

function isUniqueViolation(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const code = (err as { code?: unknown }).code;
	return code === "23505";
}

/**
 * Inserts a new generated fix with monotonic version per (scan_id, fix_type).
 *
 * Concurrency: two callers racing on the same `(scan_id, fix_type)` will both
 * read `MAX(version)+1` as the same value. The partial unique index
 * `uq_generated_fixes_scan_type_version` causes one INSERT to fail with
 * Postgres SQLSTATE 23505. This function transparently retries on that error
 * (up to CREATE_GENERATED_FIX_MAX_RETRIES attempts) so callers don't have to
 * implement their own retry loop. Soft-deleted rows are excluded from the
 * version calculation, matching the partial-unique semantics.
 */
export async function createGeneratedFix(
	db: DbClient,
	input: CreateGeneratedFixInput,
): Promise<{ id: string; version: number }> {
	let lastErr: unknown;
	for (let attempt = 0; attempt < CREATE_GENERATED_FIX_MAX_RETRIES; attempt++) {
		try {
			return await db.transaction(async (tx) => {
				const rows = await tx
					.select({
						max: sql<number>`COALESCE(MAX(${generatedFixes.version}), 0)`,
					})
					.from(generatedFixes)
					.where(
						and(
							eq(generatedFixes.scanId, input.scanId),
							eq(generatedFixes.fixType, input.fixType),
							isNull(generatedFixes.deletedAt),
						),
					);
				const nextVersion = (rows[0]?.max ?? 0) + 1;
				const inserted = await tx
					.insert(generatedFixes)
					.values({
						scanId: input.scanId,
						userId: input.userId,
						fixType: input.fixType,
						content: input.content,
						contentHash: input.contentHash,
						version: nextVersion,
						generationMetadata: input.generationMetadata,
					})
					.returning({ id: generatedFixes.id, version: generatedFixes.version });
				const row = inserted[0];
				if (!row) {
					throw new Error("createGeneratedFix: insert returned no rows");
				}
				return row;
			});
		} catch (err) {
			lastErr = err;
			if (!isUniqueViolation(err)) throw err;
			// Loop and retry: another transaction won the version race; recompute
			// MAX(version) and try the next slot.
		}
	}
	throw new Error(
		`createGeneratedFix: lost ${CREATE_GENERATED_FIX_MAX_RETRIES} consecutive version races for scan ${input.scanId}/${input.fixType}: ${
			lastErr instanceof Error ? lastErr.message : String(lastErr)
		}`,
	);
}

export async function getFixById(
	db: DbClient,
	fixId: string,
): Promise<typeof generatedFixes.$inferSelect | null> {
	const rows = await db.select().from(generatedFixes).where(eq(generatedFixes.id, fixId)).limit(1);
	return rows[0] ?? null;
}

export async function getLatestFix(
	db: DbClient,
	scanId: string,
	fixType: FixType,
): Promise<typeof generatedFixes.$inferSelect | null> {
	const rows = await db
		.select()
		.from(generatedFixes)
		.where(
			and(
				eq(generatedFixes.scanId, scanId),
				eq(generatedFixes.fixType, fixType),
				isNull(generatedFixes.deletedAt),
			),
		)
		.orderBy(desc(generatedFixes.version))
		.limit(1);
	return rows[0] ?? null;
}

export async function listFixesByScan(
	db: DbClient,
	scanId: string,
	opts: { includeDeleted?: boolean } = {},
): Promise<(typeof generatedFixes.$inferSelect)[]> {
	const conditions = opts.includeDeleted
		? eq(generatedFixes.scanId, scanId)
		: and(eq(generatedFixes.scanId, scanId), isNull(generatedFixes.deletedAt));
	return db.select().from(generatedFixes).where(conditions).orderBy(desc(generatedFixes.createdAt));
}

export async function listFixesByUser(
	db: DbClient,
	userId: string,
	opts: { fixType?: FixType; status?: FixStatus; limit?: number } = {},
): Promise<(typeof generatedFixes.$inferSelect)[]> {
	const conditions = [eq(generatedFixes.userId, userId), isNull(generatedFixes.deletedAt)];
	if (opts.fixType) conditions.push(eq(generatedFixes.fixType, opts.fixType));
	if (opts.status) conditions.push(eq(generatedFixes.status, opts.status));
	const query = db
		.select()
		.from(generatedFixes)
		.where(and(...conditions))
		.orderBy(desc(generatedFixes.createdAt));
	if (opts.limit !== undefined) {
		return query.limit(opts.limit);
	}
	return query;
}

export async function markFixStatus(
	db: DbClient,
	fixId: string,
	status: FixStatus,
	errorMessage?: string,
): Promise<void> {
	await db
		.update(generatedFixes)
		.set({ status, errorMessage: errorMessage ?? null })
		.where(eq(generatedFixes.id, fixId));
}

export async function softDeleteFix(db: DbClient, fixId: string): Promise<void> {
	await db
		.update(generatedFixes)
		.set({ deletedAt: new Date() })
		.where(eq(generatedFixes.id, fixId));
}

// ─── cms_connections ─────────────────────────────────────────────────────
// Unblocks: #263 (CMS connector), #256 (deploy worker)
// DECRYPTION BOUNDARY: only `getDecryptedCmsConnection` returns plaintext.

export interface CreateCmsConnectionInput {
	userId: string;
	cmsType: CmsType;
	siteUrl: string;
	label?: string;
	credentials: CmsCredentialsPlaintext;
}

/**
 * Two-phase insert so that the AAD can bind to the row's id (which is
 * generated by the DB on the first insert). Inside a single transaction:
 *   1. INSERT the row with encryptedCredentials = NULL to obtain the id
 *   2. UPDATE the row with the encrypted envelope using AAD(id, userId)
 */
export async function createCmsConnection(
	db: DbClient,
	input: CreateCmsConnectionInput,
): Promise<{ id: string }> {
	return db.transaction(async (tx) => {
		const inserted = await tx
			.insert(cmsConnections)
			.values({
				userId: input.userId,
				cmsType: input.cmsType,
				siteUrl: input.siteUrl,
				label: input.label,
				encryptedCredentials: null,
			})
			.returning({ id: cmsConnections.id });
		const row = inserted[0];
		if (!row) throw new Error("createCmsConnection: insert returned no rows");
		const aad = cmsCredentialsAad(row.id, input.userId);
		const envelope = encryptCmsCredentials({
			plaintext: JSON.stringify(input.credentials),
			aad,
		});
		await tx
			.update(cmsConnections)
			.set({ encryptedCredentials: envelope })
			.where(eq(cmsConnections.id, row.id));
		return row;
	});
}

/**
 * Lists active connections for a user. Strips `encryptedCredentials` from
 * the result so callers cannot accidentally surface ciphertext to clients.
 */
export async function listCmsConnections(
	db: DbClient,
	userId: string,
): Promise<Array<Omit<typeof cmsConnections.$inferSelect, "encryptedCredentials">>> {
	const rows = await db
		.select()
		.from(cmsConnections)
		.where(and(eq(cmsConnections.userId, userId), isNull(cmsConnections.deletedAt)))
		.orderBy(desc(cmsConnections.createdAt));
	return rows.map(({ encryptedCredentials: _omit, ...rest }) => rest);
}

export async function getActiveCmsConnection(
	db: DbClient,
	userId: string,
	cmsType: CmsType,
	siteUrl: string,
): Promise<typeof cmsConnections.$inferSelect | null> {
	const rows = await db
		.select()
		.from(cmsConnections)
		.where(
			and(
				eq(cmsConnections.userId, userId),
				eq(cmsConnections.cmsType, cmsType),
				eq(cmsConnections.siteUrl, siteUrl),
				eq(cmsConnections.isActive, true),
				isNull(cmsConnections.deletedAt),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

/**
 * DECRYPTION BOUNDARY — the only function that returns plaintext credentials.
 * Derives the AAD from the row's own id + user_id; never trust caller-passed
 * AAD. Throws if the connection is soft-deleted, the envelope is missing, or
 * decryption fails.
 */
export async function getDecryptedCmsConnection(
	db: DbClient,
	connectionId: string,
): Promise<{
	connection: typeof cmsConnections.$inferSelect;
	credentials: CmsCredentialsPlaintext;
}> {
	const rows = await db
		.select()
		.from(cmsConnections)
		.where(eq(cmsConnections.id, connectionId))
		.limit(1);
	const connection = rows[0];
	if (!connection) {
		throw new Error(`getDecryptedCmsConnection: connection ${connectionId} not found`);
	}
	if (connection.deletedAt) {
		throw new Error(`getDecryptedCmsConnection: connection ${connectionId} is soft-deleted`);
	}
	if (!connection.encryptedCredentials) {
		throw new Error(
			`getDecryptedCmsConnection: connection ${connectionId} has no encrypted credentials`,
		);
	}
	const aad = cmsCredentialsAad(connection.id, connection.userId);
	const plaintext = decryptCmsCredentials({
		envelope: connection.encryptedCredentials,
		aad,
	});
	const credentials = JSON.parse(plaintext) as CmsCredentialsPlaintext;
	return { connection, credentials };
}

/**
 * Re-encrypts the credentials column with a new payload. Used when the user
 * updates their CMS access token. Reuses the row's existing AAD binding.
 */
export async function rotateCmsCredentials(
	db: DbClient,
	connectionId: string,
	newCredentials: CmsCredentialsPlaintext,
): Promise<void> {
	const rows = await db
		.select({ id: cmsConnections.id, userId: cmsConnections.userId })
		.from(cmsConnections)
		.where(eq(cmsConnections.id, connectionId))
		.limit(1);
	const row = rows[0];
	if (!row) throw new Error(`rotateCmsCredentials: connection ${connectionId} not found`);
	const aad = cmsCredentialsAad(row.id, row.userId);
	const envelope = encryptCmsCredentials({
		plaintext: JSON.stringify(newCredentials),
		aad,
	});
	await db
		.update(cmsConnections)
		.set({ encryptedCredentials: envelope })
		.where(eq(cmsConnections.id, connectionId));
}

/**
 * Soft-delete: marks the row deleted, deactivates it, and wipes the
 * encrypted credential blob (no plaintext was ever in the row, but the
 * ciphertext is also removed so a future DB dump leak can't be replayed
 * with a future key compromise).
 */
export async function softDeleteCmsConnection(db: DbClient, connectionId: string): Promise<void> {
	await db
		.update(cmsConnections)
		.set({
			deletedAt: new Date(),
			isActive: false,
			encryptedCredentials: null,
		})
		.where(eq(cmsConnections.id, connectionId));
}

export async function touchCmsConnectionLastUsed(
	db: DbClient,
	connectionId: string,
): Promise<void> {
	await db
		.update(cmsConnections)
		.set({ lastUsedAt: new Date() })
		.where(eq(cmsConnections.id, connectionId));
}

// ─── deployment_attempts ─────────────────────────────────────────────────
// Unblocks: #291 (rollback), #256 (deploy worker)

export interface CreateDeploymentAttemptInput {
	fixId: string;
	cmsConnectionId: string;
	attemptNumber?: number;
	idempotencyKey?: string;
}

export async function createDeploymentAttempt(
	db: DbClient,
	input: CreateDeploymentAttemptInput,
): Promise<{ id: string }> {
	const inserted = await db
		.insert(deploymentAttempts)
		.values({
			fixId: input.fixId,
			cmsConnectionId: input.cmsConnectionId,
			attemptNumber: input.attemptNumber ?? 1,
			idempotencyKey: input.idempotencyKey ?? null,
		})
		.returning({ id: deploymentAttempts.id });
	const row = inserted[0];
	if (!row) throw new Error("createDeploymentAttempt: insert returned no rows");
	return row;
}

export interface UpdateDeploymentStatusPatch {
	status: DeploymentStatus;
	errorMessage?: string;
	errorCode?: string;
	rollbackData?: typeof deploymentAttempts.$inferInsert.rollbackData;
	completedAt?: Date;
}

/**
 * Patches a deployment attempt. Audit-immutable fields (`errorMessage`,
 * `errorCode`, `rollbackData`, `completedAt`) are ONLY written when the
 * caller passes them explicitly — omitting a field leaves the existing
 * column value untouched. This preserves the audit history when the worker
 * makes intermediate status transitions (e.g. `pending → in_progress`)
 * before the terminal write that carries the rollback payload.
 */
export async function updateDeploymentStatus(
	db: DbClient,
	attemptId: string,
	patch: UpdateDeploymentStatusPatch,
): Promise<void> {
	const set: Partial<typeof deploymentAttempts.$inferInsert> = { status: patch.status };
	if (patch.errorMessage !== undefined) set.errorMessage = patch.errorMessage;
	if (patch.errorCode !== undefined) set.errorCode = patch.errorCode;
	if (patch.rollbackData !== undefined) set.rollbackData = patch.rollbackData;
	if (patch.completedAt !== undefined) set.completedAt = patch.completedAt;
	await db.update(deploymentAttempts).set(set).where(eq(deploymentAttempts.id, attemptId));
}

export async function listDeploymentsForFix(
	db: DbClient,
	fixId: string,
): Promise<(typeof deploymentAttempts.$inferSelect)[]> {
	return db
		.select()
		.from(deploymentAttempts)
		.where(eq(deploymentAttempts.fixId, fixId))
		.orderBy(desc(deploymentAttempts.startedAt));
}

export async function listActiveDeployments(
	db: DbClient,
	limit?: number,
): Promise<(typeof deploymentAttempts.$inferSelect)[]> {
	const query = db
		.select()
		.from(deploymentAttempts)
		.where(sql`${deploymentAttempts.status} IN ('pending', 'in_progress')`)
		.orderBy(desc(deploymentAttempts.startedAt));
	if (limit !== undefined) return query.limit(limit);
	return query;
}

// ─── fix_validations ─────────────────────────────────────────────────────
// Unblocks: #291, #300

export interface RecordValidationInput {
	deploymentId: string;
	scanId: string | null;
	status: ValidationStatus;
	results: typeof fixValidations.$inferInsert.results;
}

export async function recordValidation(
	db: DbClient,
	input: RecordValidationInput,
): Promise<{ id: string }> {
	const inserted = await db
		.insert(fixValidations)
		.values({
			deploymentId: input.deploymentId,
			scanId: input.scanId,
			status: input.status,
			results: input.results,
		})
		.returning({ id: fixValidations.id });
	const row = inserted[0];
	if (!row) throw new Error("recordValidation: insert returned no rows");
	return row;
}

export async function listValidationsForDeployment(
	db: DbClient,
	deploymentId: string,
): Promise<(typeof fixValidations.$inferSelect)[]> {
	return db
		.select()
		.from(fixValidations)
		.where(eq(fixValidations.deploymentId, deploymentId))
		.orderBy(desc(fixValidations.validatedAt));
}

// ─── Fix overview with latest deployment + validation (#302) ────────────

export interface FixWithLatestDeployment {
	fix: typeof generatedFixes.$inferSelect;
	deployment: typeof deploymentAttempts.$inferSelect | null;
	validation: typeof fixValidations.$inferSelect | null;
}

/**
 * Lists all fixes for a user, each joined with its latest deployment attempt
 * and the latest validation for that deployment. Used by the fix overview page.
 */
export async function listFixesWithLatestDeployment(
	db: DbClient,
	userId: string,
): Promise<FixWithLatestDeployment[]> {
	const fixes = await db
		.select()
		.from(generatedFixes)
		.where(and(eq(generatedFixes.userId, userId), isNull(generatedFixes.deletedAt)))
		.orderBy(desc(generatedFixes.createdAt));

	const results: FixWithLatestDeployment[] = [];
	for (const fix of fixes) {
		// Latest deployment for this fix
		const deployments = await db
			.select()
			.from(deploymentAttempts)
			.where(eq(deploymentAttempts.fixId, fix.id))
			.orderBy(desc(deploymentAttempts.startedAt))
			.limit(1);
		const deployment = deployments[0] ?? null;

		let validation: typeof fixValidations.$inferSelect | null = null;
		if (deployment) {
			const validations = await db
				.select()
				.from(fixValidations)
				.where(eq(fixValidations.deploymentId, deployment.id))
				.orderBy(desc(fixValidations.validatedAt))
				.limit(1);
			validation = validations[0] ?? null;
		}

		results.push({ fix, deployment, validation });
	}
	return results;
}

/**
 * Get the siteUrl for a CMS connection by ID.
 */
export async function getCmsConnectionSiteUrl(
	db: DbClient,
	connectionId: string,
): Promise<string | null> {
	const rows = await db
		.select({ siteUrl: cmsConnections.siteUrl })
		.from(cmsConnections)
		.where(eq(cmsConnections.id, connectionId))
		.limit(1);
	return rows[0]?.siteUrl ?? null;
}

// ─── Billing usage counting (#309) ──────────────────────────────────────

/**
 * Count generated fixes for a user since a given date (billing period start).
 * Used by checkFixQuota to enforce monthly fix limits.
 */
export async function countFixesForUserInPeriod(
	db: DbClient,
	userId: string,
	since: Date,
): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(generatedFixes)
		.where(
			and(
				eq(generatedFixes.userId, userId),
				isNull(generatedFixes.deletedAt),
				sql`${generatedFixes.createdAt} >= ${since}`,
			),
		);
	return rows[0]?.count ?? 0;
}

/**
 * Count deployment attempts for a user since a given date.
 * Excludes rolled-back attempts. Used by checkDeploymentQuota.
 */
export async function countDeploymentsForUserInPeriod(
	db: DbClient,
	userId: string,
	since: Date,
): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(deploymentAttempts)
		.innerJoin(generatedFixes, eq(deploymentAttempts.fixId, generatedFixes.id))
		.where(
			and(
				eq(generatedFixes.userId, userId),
				sql`${deploymentAttempts.startedAt} >= ${since}`,
				sql`${deploymentAttempts.status} != 'rolled_back'`,
			),
		);
	return rows[0]?.count ?? 0;
}

// ─── Deployment status tracking (#291) ──────────────────────────────────

/**
 * Get a single deployment attempt by ID.
 */
export async function getDeploymentAttemptById(
	db: DbClient,
	attemptId: string,
): Promise<typeof deploymentAttempts.$inferSelect | null> {
	const rows = await db
		.select()
		.from(deploymentAttempts)
		.where(eq(deploymentAttempts.id, attemptId))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Resolve the owning userId for a deployment attempt via the FK chain
 * deployment_attempts → generated_fixes → userId.
 */
export async function getDeploymentOwnerUserId(
	db: DbClient,
	attemptId: string,
): Promise<string | null> {
	const rows = await db
		.select({ userId: generatedFixes.userId })
		.from(deploymentAttempts)
		.innerJoin(generatedFixes, eq(deploymentAttempts.fixId, generatedFixes.id))
		.where(eq(deploymentAttempts.id, attemptId))
		.limit(1);
	return rows[0]?.userId ?? null;
}
