# Google auth (Supabase)

1. **Supabase Dashboard** → Authentication → Providers → **Google** → enable and add OAuth client ID/secret from [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

2. **Redirect URLs** (Authentication → URL configuration):
   - `http://localhost:5173`
   - `https://slim-svg.vercel.app` (your production frontend)

3. **Site URL**: same as your primary frontend URL.

4. **Environment**
   - Root `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon/public key)
   - Vercel: same `VITE_*` vars + existing `VITE_API_URL`
   - Render API: unchanged (`SUPABASE_URL`, service role, `CRON_SECRET`)

5. **Migration** — run `supabase/migrations/004_user_auth.sql` in the SQL editor (adds `user_id`, nullable `original_path`).

Pre-auth assets without `user_id` are invisible to signed-in users; delete them manually in Supabase if needed.
