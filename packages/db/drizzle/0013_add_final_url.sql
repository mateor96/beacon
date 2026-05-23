-- Add missing final_url column to scans table
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "final_url" text;
