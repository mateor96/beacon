import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
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

export const publicAuditRequests = pgTable(
	"public_audit_requests",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ipHash: text("ip_hash").notNull(), // DSGVO: personenbezogen (pseudonymisiert)
		fingerprint: text("fingerprint"),
		url: text("url").notNull(),
		status: text("status", { enum: ["pending", "processing", "completed", "failed"] })
			.notNull()
			.default("pending"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		index("idx_public_audit_requests_url").on(table.url),
		index("idx_public_audit_requests_ip_hash").on(table.ipHash),
		index("idx_public_audit_requests_ip_hash_created").on(table.ipHash, table.createdAt),
		index("idx_public_audit_requests_status_pending")
			.on(table.status)
			.where(sql`${table.status} != 'completed'`),
	],
);

export const publicAuditResults = pgTable(
	"public_audit_results",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		requestId: uuid("request_id")
			.notNull()
			.references(() => publicAuditRequests.id, { onDelete: "cascade" }),
		overallScore: integer("overall_score").notNull(),
		modelScores: jsonb("model_scores").notNull(),
		summary: text("summary"),
		rawData: jsonb("raw_data"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [uniqueIndex("idx_public_audit_results_request_id").on(table.requestId)],
);

export const publicLeads = pgTable(
	"public_leads",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		requestId: uuid("request_id")
			.notNull()
			.references(() => publicAuditRequests.id, { onDelete: "cascade" }),
		email: text("email").notNull(), // DSGVO: personenbezogen
		companyName: text("company_name"),
		utmSource: text("utm_source"),
		utmMedium: text("utm_medium"),
		utmCampaign: text("utm_campaign"),
		convertedToSignup: boolean("converted_to_signup").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_public_leads_request_id").on(table.requestId),
		index("idx_public_leads_email").on(table.email),
	],
);

export const publicConversionEvents = pgTable(
	"public_conversion_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		requestId: uuid("request_id")
			.notNull()
			.references(() => publicAuditRequests.id, { onDelete: "cascade" }),
		leadId: uuid("lead_id").references(() => publicLeads.id, { onDelete: "set null" }),
		eventType: text("event_type", {
			enum: [
				"page_visit",
				"audit_submitted",
				"teaser_viewed",
				"email_entered",
				"report_viewed",
				"signup_initiated",
			],
		}).notNull(),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_public_conversion_events_request_created").on(table.requestId, table.createdAt),
		index("idx_public_conversion_events_event_type_created").on(table.eventType, table.createdAt),
	],
);

export const publicAuditRequestsRelations = relations(publicAuditRequests, ({ one, many }) => ({
	result: one(publicAuditResults, {
		fields: [publicAuditRequests.id],
		references: [publicAuditResults.requestId],
	}),
	lead: one(publicLeads, { fields: [publicAuditRequests.id], references: [publicLeads.requestId] }),
	events: many(publicConversionEvents),
}));

export const publicAuditResultsRelations = relations(publicAuditResults, ({ one }) => ({
	request: one(publicAuditRequests, {
		fields: [publicAuditResults.requestId],
		references: [publicAuditRequests.id],
	}),
}));

export const publicLeadsRelations = relations(publicLeads, ({ one, many }) => ({
	request: one(publicAuditRequests, {
		fields: [publicLeads.requestId],
		references: [publicAuditRequests.id],
	}),
	events: many(publicConversionEvents),
}));

export const publicConversionEventsRelations = relations(publicConversionEvents, ({ one }) => ({
	request: one(publicAuditRequests, {
		fields: [publicConversionEvents.requestId],
		references: [publicAuditRequests.id],
	}),
	lead: one(publicLeads, { fields: [publicConversionEvents.leadId], references: [publicLeads.id] }),
}));
