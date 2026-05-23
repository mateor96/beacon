-- v0.2 webhook-delivery worker rebuild (#9): add 'dead_letter' to the
-- webhook_deliveries.status column. The column is a text column (per
-- repo convention — no pgEnum), so no schema change is needed; this
-- migration is a no-op on Postgres but exists to document the schema
-- delta in the journal alongside the code change.
--
-- A future check constraint could pin the values, but the application
-- layer is the source of truth via WEBHOOK_DELIVERY_STATUSES.

SELECT 1;
