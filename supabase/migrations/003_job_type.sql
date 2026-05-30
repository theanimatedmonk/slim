-- Job type for Postgres-backed queue (no Redis)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'optimize';
