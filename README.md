# Android Asset Optimiser

Upload SVG assets. The pipeline optimizes them automatically until size reduction stabilizes, analyzes complexity, recommends WebP when appropriate, and lets you download optimized bundles.

No manual SVGO settings — upload and the system handles the rest.

## Features

- Drag-and-drop SVG upload (batch supported)
- Iterative **SVGO** optimization until stabilization (&lt;1% improvement per pass, max 8 passes)
- **Complexity analysis** after optimization (`simple` / `moderate` / `complex`)
- **WebP conversion** recommended for complex SVGs or embedded raster images
- ZIP download with `/svg`, `/webp`, and `report.json`

## How it works

```text
Upload SVG → Supabase Storage
     ↓
Optimization queue (Redis + BullMQ)
     ↓
Worker: SVGO passes → complexity check → store result
     ↓
Download optimized SVG / WebP / bundle
```

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React, Vite, Tailwind CSS, TanStack Query |
| API | Node.js, Express |
| Worker | BullMQ, SVGO, Sharp, archiver |
| Data | Supabase (Postgres + Storage) |
| Queue | Redis |

## Prerequisites

- **Node.js 20+**
- **Redis** (local: [Homebrew](https://brew.sh) `brew install redis` or Docker)
- **Supabase** project (free tier is fine)

## Local setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd asset-optimiser
npm install
```

### 2. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** secret key (not `anon`) |
| `SUPABASE_STORAGE_BUCKET` | `assets` |
| `REDIS_URL` | `redis://localhost:6379` (default) |
| `PORT` | API port (default `3001`) |
| `FRONTEND_URL` | `http://localhost:5173` |
| `VITE_API_URL` | `http://localhost:3001` |

> **Security:** Never commit `.env` or share your `service_role` key. It is listed in `.gitignore` and must stay on your machine only.

### 3. Supabase database and storage

1. **SQL Editor** — run migrations in order:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_grants_and_policies.sql`
2. When prompted about RLS, choose **Run and enable RLS**.
3. **Storage** → create a **private** bucket named `assets` (all toggles off).

### 4. Start Redis

**Homebrew (macOS):**

```bash
brew install redis
brew services start redis
redis-cli ping   # should return PONG
```

**Docker (optional):**

```bash
docker compose up -d
```

### 5. Run the app

```bash
npm run dev
```

This builds shared packages, then starts the API, worker, and frontend together.

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| API health | http://localhost:3001/health |

### Run services separately

```bash
npm run dev:backend
npm run dev:worker
npm run dev:frontend
```

## Using the app

1. Open http://localhost:5173
2. Drop one or more `.svg` files
3. Go to **Workspace** → **Optimize All**
4. Watch status, pass count, reduction %, and complexity per asset
5. Open a row for pass-by-pass details
6. Use **Convert to WebP** when recommended (complex SVGs or embedded images)
7. **Download Bundle** for a ZIP of optimized assets

## Complexity levels

After optimization stabilizes, the worker scores the SVG:

| Level | Score | WebP recommended? |
|-------|-------|-------------------|
| Simple | 0–1 | No |
| Moderate | 2–4 | Only if embedded base64 image detected |
| Complex | 5+ | Yes |

Scoring checks file size (&gt;250KB), long paths, node count, gradients, filters, masks, clip paths, and embedded raster images.

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload-url` | Signed upload URL |
| `POST` | `/api/assets/register` | Register asset after upload |
| `GET` | `/api/assets` | List assets with jobs |
| `POST` | `/api/optimize` | Queue optimization |
| `GET` | `/api/job/:id` | Job status and passes |
| `POST` | `/api/convert-webp` | Queue WebP conversion |
| `POST` | `/api/download` | Queue ZIP bundle |
| `GET` | `/api/download/:jobId` | Signed ZIP download URL |

## Project structure

```text
apps/frontend          Web UI
apps/backend           REST API
apps/worker            Optimization worker
packages/shared-types  Shared TypeScript types
packages/shared-utils  Shared constants and helpers
supabase/migrations    Database SQL
```

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `Failed to fetch` | Ensure `npm run dev` shows backend on port 3001; visit `/health` |
| `permission denied for table assets` | Run `002_grants_and_policies.sql`; use **service_role** key in `.env` |
| Jobs stay queued | Redis running? `redis-cli ping` → `PONG` |
| `buildStoragePath` / module errors | `npm run build -w @asset-optimiser/shared-utils` then restart `npm run dev` |
| npm `ECONNREFUSED` to registry | VPN off; check network / proxy |

## License

Private / all rights reserved — update as needed.
