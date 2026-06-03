-- Reliability + performance: job leasing and hot-path indexes.

-- 1. Job lease — lets the queue reclaim jobs whose worker died mid-run
--    (otherwise they stay stuck in 'optimizing'/'converting' forever).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE zip_bundles ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- 2. Indexes for the queue claim queries (status + created_at ordering)
--    and the periodic cleanup scan.
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_zip_bundles_status_created_at ON zip_bundles(status, created_at);
CREATE INDEX IF NOT EXISTS idx_job_passes_job_id ON job_passes(job_id);
