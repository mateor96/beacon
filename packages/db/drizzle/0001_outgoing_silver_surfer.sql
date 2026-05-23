DROP INDEX "idx_anon_date";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_anon_ip_date" ON "anonymous_scans" USING btree ("ip_hash","scan_date");