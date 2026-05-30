-- Fix "permission denied for table assets" after enabling RLS
-- Run this in Supabase SQL Editor after 001_initial.sql

-- 1. Grant schema + table access to Supabase API roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, anon;

-- 2. RLS policies (service_role bypasses RLS, but policies help anon/authenticated if needed later)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_bundles ENABLE ROW LEVEL SECURITY;

-- Backend uses service_role — full access via bypass; these policies are for completeness
DROP POLICY IF EXISTS "service_role_all_assets" ON assets;
DROP POLICY IF EXISTS "service_role_all_jobs" ON jobs;
DROP POLICY IF EXISTS "service_role_all_reports" ON optimization_reports;
DROP POLICY IF EXISTS "service_role_all_passes" ON job_passes;
DROP POLICY IF EXISTS "service_role_all_zips" ON zip_bundles;

CREATE POLICY "service_role_all_assets" ON assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_jobs" ON jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_reports" ON optimization_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_passes" ON job_passes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_zips" ON zip_bundles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
