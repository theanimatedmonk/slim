# Deployment Guide — Supabase + Render

Follow these steps in order. You will end up with:

- **Supabase** → Postgres database + Storage (S3-compatible) for SVG/WebP/ZIP files
- **Render** → API (backend), background worker, Redis, and optional static frontend

---

## Part A — Supabase (Database + Storage)

### A1. Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → pick org, name (e.g. `asset-optimiser`), region, database password
3. Wait until the project is **Active**

### A2. Run the database migration

1. In Supabase: **SQL Editor** → **New query**
2. Copy the full contents of `supabase/migrations/001_initial.sql` from this repo
3. Click **Run**
4. Confirm tables exist: **Table Editor** → you should see `assets`, `jobs`, `optimization_reports`, `job_passes`, `zip_bundles`

### A3. Create the Storage bucket

1. **Storage** → **New bucket**
2. Name: `assets` (must match `SUPABASE_STORAGE_BUCKET` in env)
3. **Public bucket**: OFF (private — uploads use signed URLs)
4. Create the bucket

Folder layout is created automatically on upload:

```text
originals/{assetId}/{filename}
optimized/{assetId}/{filename}
webp/{assetId}/{filename}.webp
zips/{bundleId}/optimized-assets.zip
```

### A4. Collect Supabase credentials

**Project Settings** → **API**:

| Variable | Where to find it |
|----------|------------------|
| `SUPABASE_URL` | Project URL, e.g. `https://abcdefgh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (secret — never put in frontend) |

> The backend and worker use the **service role** key so they can read/write storage and Postgres without end-user auth (MVP has no login).

### A5. Local `.env` (for development)

At the **repo root**:

```bash
cp .env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
SUPABASE_STORAGE_BUCKET=assets

REDIS_URL=redis://localhost:6379

PORT=3001
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3001
```

---

## Part B — Redis (required for BullMQ)

Render needs Redis for the job queue. Pick **one**:

### Option 1 — Render Redis (simplest if everything is on Render)

1. Render Dashboard → **New +** → **Redis**
2. Name: `asset-optimiser-redis`
3. After creation, copy **Internal Redis URL** (use this for `REDIS_URL` on API + worker)

### Option 2 — Upstash Redis (free tier friendly)

1. [https://upstash.com](https://upstash.com) → create Redis database
2. Copy the **Redis URL** (`rediss://...`) into `REDIS_URL`

### Option 3 — Local only

```bash
docker compose up -d
```

Uses `REDIS_URL=redis://localhost:6379`

---

## Part C — Render (Backend + Worker)

Push this repo to **GitHub** first (Render deploys from Git).

### C1. Create the Backend Web Service

1. Render → **New +** → **Web Service** → connect your GitHub repo
2. Settings:

| Field | Value |
|-------|--------|
| **Name** | `asset-optimiser-api` |
| **Root Directory** | *(leave empty — repo root)* |
| **Runtime** | Node |
| **Build Command** | see below |
| **Start Command** | `npm run start -w @asset-optimiser/backend` |
| **Instance type** | Free or Starter |

**Build command** (paste as one line):

```bash
npm install && npm run build -w @asset-optimiser/shared-types && npm run build -w @asset-optimiser/shared-utils && npm run build -w @asset-optimiser/backend
```

3. **Environment** variables:

| Key | Value |
|-----|--------|
| `SUPABASE_URL` | From Supabase (A4) |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase (A4) |
| `SUPABASE_STORAGE_BUCKET` | `assets` |
| `REDIS_URL` | Render Redis internal URL or Upstash URL |
| `PORT` | `3001` (Render sets `PORT` automatically — you can omit or use `10000`; Render injects `PORT`) |
| `FRONTEND_URL` | Your frontend URL (see Part D), e.g. `https://asset-optimiser.onrender.com` |

> Render sets `PORT` for you. The backend reads `process.env.PORT` — no change needed if you use default config.

4. **Deploy** → note the public URL, e.g. `https://asset-optimiser-api.onrender.com`

### C2. Create the Worker (Background Worker)

1. Render → **New +** → **Background Worker** → same repo
2. Settings:

| Field | Value |
|-------|--------|
| **Name** | `asset-optimiser-worker` |
| **Build Command** | same as API |
| **Start Command** | `npm run start -w @asset-optimiser/worker` |

**Build command**:

```bash
npm install && npm run build -w @asset-optimiser/shared-types && npm run build -w @asset-optimiser/shared-utils && npm run build -w @asset-optimiser/worker
```

3. **Environment** — same as API **except** no `FRONTEND_URL` required:

| Key | Value |
|-----|--------|
| `SUPABASE_URL` | Same as API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as API |
| `SUPABASE_STORAGE_BUCKET` | `assets` |
| `REDIS_URL` | **Same Redis URL as API** (critical) |

4. Deploy. Check **Logs** — you should see: `Worker listening for jobs on asset-optimization queue`

### C3. Verify API + Worker + Redis

1. Open `https://YOUR-API.onrender.com/health` → `{"status":"ok"}`
2. Upload an SVG from the frontend
3. Click **Optimize All** → worker logs should show job completion
4. Supabase **Storage** → `assets` bucket → files under `originals/` and `optimized/`

---

## Part D — Frontend hosting

### Option 1 — Render Static Site

1. **New +** → **Static Site** → same repo
2. **Build command**:

```bash
npm install && npm run build -w @asset-optimiser/shared-types && npm run build -w @asset-optimiser/shared-utils && npm run build -w @asset-optimiser/frontend
```

3. **Publish directory**: `apps/frontend/dist`
4. **Environment**:

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://asset-optimiser-api.onrender.com` (no trailing slash) |

5. Redeploy API with updated `FRONTEND_URL` = static site URL (for CORS)

### Option 2 — Vercel / Netlify

- Root: `apps/frontend`
- Build: `npm run build` (from monorepo root with workspace flags as above)
- Env: `VITE_API_URL=https://your-api.onrender.com`

---

## Part E — Checklist (copy/paste)

```text
[ ] Supabase project created
[ ] SQL migration run (001_initial.sql)
[ ] Storage bucket "assets" created (private)
[ ] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY saved
[ ] Redis running (Render Redis or Upstash)
[ ] GitHub repo pushed
[ ] Render Web Service (API) deployed — /health works
[ ] Render Background Worker deployed — logs show queue listener
[ ] REDIS_URL identical on API and worker
[ ] FRONTEND_URL on API matches frontend origin
[ ] VITE_API_URL on frontend matches API URL
[ ] Test: upload SVG → optimize → see files in Supabase Storage
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Upload fails | Check bucket name `assets`, service role key, bucket exists |
| Jobs stay queued | Worker not running, or `REDIS_URL` mismatch between API and worker |
| CORS error | Set `FRONTEND_URL` on API to exact frontend origin (scheme + host, no path) |
| API 500 on upload-url | Supabase Storage enabled; service role key valid |
| Worker crashes on Sharp | Use Render instance with enough memory; Starter tier recommended for WebP |
| Cold start slow | Free tier API sleeps; first request may take 30–60s |

---

## Security notes

- Never commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend
- Only `VITE_*` vars are exposed to the browser — use `VITE_API_URL` only
- Rotate service role key if leaked (Supabase → Settings → API → reset)

---

## Architecture after deploy

```text
Browser (Static site)
    │  VITE_API_URL
    ▼
Render Web Service (Express API)
    │  enqueue jobs          │  signed URLs
    ▼                        ▼
Render Redis (BullMQ)    Supabase Storage
    │
    ▼
Render Background Worker (SVGO / Sharp / ZIP)
    │
    └──► Supabase Postgres + Storage
```
