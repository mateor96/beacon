CREATE INDEX "idx_scans_user_locale_scanned" ON "scans" USING btree ("user_id","locale_id","scanned_at" DESC NULLS LAST);
