import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

// ─── Enums (text + const arrays; repo convention, no pgEnum) ─────────────

export const WEBHOOK_DELIVERY_STATUSES = ["pending", "delivered", "failed", "dead_letter"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

// ─── webhook_endpoints ──────────────────────────────────────────────────
// One row per registered webhook endpoint. Secret is AES-256-GCM encrypted.

export const webhookEndpoints = pgTable(
	"webhook_endpoints",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		url: text("url").notNull(),

		// AES-256-GCM JSON envelope; plaintext is only shown on creation.
		encryptedSecret: text("encrypted_secret").notNull(),

		// Array of event type strings the endpoint subscribes to.
		events: jsonb("events").$type<string[]>().notNull(),

		active: boolean("active").notNull().default(true),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		index("idx_webhook_endpoints_active").on(table.active).where(sql`${table.active} = true`),
	],
);

// ─── webhook_deliveries ─────────────────────────────────────────────────
// Immutable audit log of delivery attempts per endpoint.

export const webhookDeliveries = pgTable(
	"webhook_deliveries",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		endpointId: uuid("endpoint_id")
			.references(() => webhookEndpoints.id, { onDelete: "cascade" })
			.notNull(),

		eventType: text("event_type").notNull(),

		payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

		status: text("status", { enum: WEBHOOK_DELIVERY_STATUSES }).notNull().default("pending"),

		attempts: integer("attempts").notNull().default(0),

		responseStatus: integer("response_status"),
		responseBody: text("response_body"),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_webhook_deliveries_endpoint").on(table.endpointId, table.createdAt.desc()),
		index("idx_webhook_deliveries_status").on(table.status).where(sql`${table.status} = 'failed'`),
		index("idx_webhook_deliveries_created").on(table.createdAt.desc()),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ many }) => ({
	deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
	endpoint: one(webhookEndpoints, {
		fields: [webhookDeliveries.endpointId],
		references: [webhookEndpoints.id],
	}),
}));
