# Android Asset Optimiser

An asynchronous SVG optimisation pipeline for Android assets. Upload SVGs, the system optimizes automatically until stabilization, analyzes complexity, recommends WebP when needed, and generates downloadable bundles.

## Architecture

```text
apps/frontend     React + Vite + Tailwind + TanStack Query
apps/backend      Express API + BullMQ producer
apps/worker       BullMQ worker (SVGO, Sharp, archiver)
packages/shared-* Shared types and utilities
```

## Prerequisites

- Node.js 20+
- Docker (for local Redis)
- Supabase project (Postgres + Storage)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` at the repo root and fill in Supabase credentials:

```bash
cp .env.example .env
```

### 3. Set up Supabase

1. Run the SQL migration in `supabase/migrations/001_initial.sql` in the Supabase SQL editor.
2. Create a storage bucket named `assets` (or match `SUPABASE_STORAGE_BUCKET`).
3. Ensure bucket policies allow signed uploads/downloads via the service role.

### 4. Start Redis

```bash
docker compose up -d
```

### 5. Build shared packages

```bash
npm run build -w @asset-optimiser/shared-types
npm run build -w @asset-optimiser/shared-utils
```

### 6. Run all services

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

Or run individually:

```bash
npm run dev:backend
npm run dev:worker
npm run dev:frontend
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload-url` | Get signed upload URL |
| POST | `/api/assets/register` | Register asset after upload |
| GET | `/api/assets` | List assets with job data |
| POST | `/api/optimize` | Queue optimization jobs |
| GET | `/api/job/:id` | Job status and passes |
| POST | `/api/convert-webp` | Queue WebP conversion |
| POST | `/api/download` | Queue ZIP bundle generation |
| GET | `/api/download/:jobId` | Get signed ZIP download URL |

## Optimization Engine

- **SVGO** with multipass until stabilization (<1% size delta per pass)
- Max **8 passes** with validation rollback on invalid output
- **Complexity analysis** after stabilization (size, paths, gradients, filters, base64)
- **Sharp** for WebP conversion (quality 80)
- **archiver** for ZIP bundles (`/svg`, `/webp`, `report.json`)

## Deployment (Supabase + Render)

**Full step-by-step guide:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

Quick overview:

1. **Supabase** — run `supabase/migrations/001_initial.sql`, create private bucket `assets`, copy URL + service role key
2. **Redis** — Render Redis or Upstash; set `REDIS_URL` on API and worker (must match)
3. **Render** — Web Service (API) + Background Worker + optional Static Site
4. Wire env vars: `FRONTEND_URL` on API, `VITE_API_URL` on frontend

Optional: deploy all Render services via [render.yaml](render.yaml) (Blueprint).

## MVP Scope

Included: SVG uploads, batch optimization, stabilization, complexity analysis, WebP recommendation, ZIP downloads.

Excluded: Auth, team workspaces, manual SVGO controls, SVG editing, CI/CD, VectorDrawable export.
