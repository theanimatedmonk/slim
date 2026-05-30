-- Asset Optimiser initial schema

create extension if not exists "uuid-ossp";

create table if not exists assets (
  id uuid primary key default uuid_generate_v4(),
  filename text not null,
  original_path text not null,
  optimized_path text,
  webp_path text,
  original_size int not null,
  optimized_size int,
  complexity text default 'unknown',
  status text default 'uploaded',
  created_at timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references assets(id) on delete cascade,
  status text default 'queued',
  passes int default 0,
  reduction_percent float default 0,
  stabilized boolean default false,
  created_at timestamptz default now()
);

create table if not exists optimization_reports (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references assets(id) on delete cascade,
  operations jsonb default '[]'::jsonb,
  gradients int default 0,
  path_count int default 0,
  base64_detected boolean default false,
  final_complexity_score int default 0,
  created_at timestamptz default now()
);

create table if not exists job_passes (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  pass_number int not null,
  size_bytes int not null,
  reduction_percent float not null,
  created_at timestamptz default now()
);

create index if not exists idx_assets_status on assets(status);
create index if not exists idx_jobs_asset_id on jobs(asset_id);
create index if not exists idx_optimization_reports_asset_id on optimization_reports(asset_id);

create table if not exists zip_bundles (
  id uuid primary key default uuid_generate_v4(),
  asset_ids uuid[] not null,
  storage_path text,
  status text default 'processing',
  created_at timestamptz default now()
);
