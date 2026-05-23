import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	type WebhookDeliveryStatus,
	webhookDeliveries,
	webhookEndpoints,
} from "../schema/webhooks";

// ─── webhook_endpoints ──────────────────────────────────────────────────

export interface CreateWebhookEndpointInput {
	url: string;
	encryptedSecret: string;
	events: string[];
}

export async function create(
	db: DbClient,
	input: CreateWebhookEndpointInput,
): Promise<{ id: string }> {
	const inserted = await db
		.insert(webhookEndpoints)
		.values({
			url: input.url,
			encryptedSecret: input.encryptedSecret,
			events: input.events,
		})
		.returning({ id: webhookEndpoints.id });
	const row = inserted[0];
	if (!row) throw new Error("createWebhookEndpoint: insert returned no rows");
	return row;
}

export async function listAll(
	db: DbClient,
): Promise<Array<Omit<typeof webhookEndpoints.$inferSelect, "encryptedSecret">>> {
	const rows = await db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt));
	return rows.map(({ encryptedSecret: _omit, ...rest }) => rest);
}

export async function getById(
	db: DbClient,
	endpointId: string,
): Promise<typeof webhookEndpoints.$inferSelect | null> {
	const rows = await db
		.select()
		.from(webhookEndpoints)
		.where(eq(webhookEndpoints.id, endpointId))
		.limit(1);
	return rows[0] ?? null;
}

export interface UpdateWebhookEndpointInput {
	url?: string;
	events?: string[];
	active?: boolean;
}

export async function update(
	db: DbClient,
	endpointId: string,
	patch: UpdateWebhookEndpointInput,
): Promise<void> {
	const set: Partial<typeof webhookEndpoints.$inferInsert> = {};
	if (patch.url !== undefined) set.url = patch.url;
	if (patch.events !== undefined) set.events = patch.events;
	if (patch.active !== undefined) set.active = patch.active;
	await db.update(webhookEndpoints).set(set).where(eq(webhookEndpoints.id, endpointId));
}

export async function deleteById(db: DbClient, endpointId: string): Promise<void> {
	await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));
}

// ─── webhook_deliveries ─────────────────────────────────────────────────

export interface CreateWebhookDeliveryInput {
	endpointId: string;
	eventType: string;
	payload: Record<string, unknown>;
	status?: WebhookDeliveryStatus;
	attempts?: number;
	responseStatus?: number | null;
	responseBody?: string | null;
}

export async function createDelivery(
	db: DbClient,
	input: CreateWebhookDeliveryInput,
): Promise<{ id: string }> {
	const inserted = await db
		.insert(webhookDeliveries)
		.values({
			endpointId: input.endpointId,
			eventType: input.eventType,
			payload: input.payload,
			status: input.status ?? "pending",
			attempts: input.attempts ?? 0,
			responseStatus: input.responseStatus ?? null,
			responseBody: input.responseBody ?? null,
		})
		.returning({ id: webhookDeliveries.id });
	const row = inserted[0];
	if (!row) throw new Error("createWebhookDelivery: insert returned no rows");
	return row;
}

export async function listDeliveries(
	db: DbClient,
	endpointId: string,
	opts: { page?: number; limit?: number } = {},
): Promise<{
	deliveries: (typeof webhookDeliveries.$inferSelect)[];
	total: number;
}> {
	const page = opts.page ?? 1;
	const limit = opts.limit ?? 20;
	const offset = (page - 1) * limit;

	const [deliveries, countResult] = await Promise.all([
		db
			.select()
			.from(webhookDeliveries)
			.where(eq(webhookDeliveries.endpointId, endpointId))
			.orderBy(desc(webhookDeliveries.createdAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)::int` })
			.from(webhookDeliveries)
			.where(eq(webhookDeliveries.endpointId, endpointId)),
	]);

	return { deliveries, total: countResult[0]?.count ?? 0 };
}

/**
 * Remove deliveries older than the given date. Used for periodic cleanup.
 */
export async function cleanupOldDeliveries(db: DbClient, olderThan: Date): Promise<number> {
	const result = await db
		.delete(webhookDeliveries)
		.where(lt(webhookDeliveries.createdAt, olderThan))
		.returning({ id: webhookDeliveries.id });
	return result.length;
}
