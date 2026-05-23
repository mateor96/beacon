import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const benchmarkGroups = pgTable("benchmark_groups", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.references(() => profiles.id, { onDelete: "cascade" })
		.notNull(),
	name: text("name").notNull(),
	urls: text("urls").array().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdateFn(() => new Date()),
});

export const benchmarkGroupsRelations = relations(benchmarkGroups, ({ one }) => ({
	user: one(profiles, {
		fields: [benchmarkGroups.userId],
		references: [profiles.id],
	}),
}));
