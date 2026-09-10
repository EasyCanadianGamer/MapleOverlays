CREATE TABLE IF NOT EXISTS custom_overlays (
  id             SERIAL PRIMARY KEY,
  twitch_user_id TEXT NOT NULL REFERENCES channels(twitch_user_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  widgets        JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_overlays_channel ON custom_overlays(twitch_user_id);
