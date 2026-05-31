-- Per-user assets (Google auth via Supabase Auth)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);

-- Allow original file to be removed from storage after optimization
ALTER TABLE assets ALTER COLUMN original_path DROP NOT NULL;
