import { sql } from "drizzle-orm";
import { date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const anonymousScans = pgTable(
	"anonymous_scans",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ipHash: text("ip_hash").notNull(), // DSGVO: personenbezogen (pseudonymisiert)
		scanCount: integer("scan_count").notNull().default(1),
		scanDate: date("scan_date").notNull().defaultNow(),
		expiresAt: date("expires_at").notNull().default(sql`(CURRENT_DATE + 30)`),
	},
	(table) => [uniqueIndex("uq_anon_ip_date").on(table.ipHash, table.scanDate)],
);
