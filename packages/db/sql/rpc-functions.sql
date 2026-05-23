-- Beacon RPC Functions (open-source build)
--
-- The OSS distribution has no plan tiers or per-user scan quotas, so the
-- previous check_scan_limit / check_daily_scan_limit / check_anonymous_scan_limit
-- helpers have been removed. Only the JSONB merge helper used by the fix
-- processor remains.

-- merge_scan_fixes: atomically merge a JSONB map of generated fixes into
-- scans.fixes (object-level merge, last-write-wins per fix key).
CREATE OR REPLACE FUNCTION merge_scan_fixes(
  p_scan_id uuid,
  p_fixes jsonb
)
RETURNS TABLE(merged boolean, fix_count int)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current jsonb;
  v_merged jsonb;
BEGIN
  SELECT COALESCE(fixes, '{}'::jsonb)
  INTO v_current
  FROM scans
  WHERE id = p_scan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  v_merged := v_current || COALESCE(p_fixes, '{}'::jsonb);

  UPDATE scans
  SET fixes = v_merged,
      updated_at = now()
  WHERE id = p_scan_id;

  RETURN QUERY SELECT true, jsonb_object_keys_count(v_merged);
END;
$$;

-- jsonb_object_keys_count helper (pg has no built-in count over jsonb_object_keys).
CREATE OR REPLACE FUNCTION jsonb_object_keys_count(p jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT count(*)::int FROM jsonb_object_keys(p);
$$;
