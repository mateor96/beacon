-- Add quota_compensated_at column to scans table for idempotent rollback
ALTER TABLE "scans" ADD COLUMN "quota_compensated_at" timestamp with time zone;
