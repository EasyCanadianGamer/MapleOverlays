CREATE TABLE IF NOT EXISTS overlays (
  id             UUID PRIMARY KEY,
  twitch_user_id TEXT NOT NULL REFERENCES channels(twitch_user_id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('chat', 'nowplaying')),
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  config         JSONB NOT NULL DEFAULT '{}',
  token          TEXT NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_overlays_channel ON overlays(twitch_user_id);
