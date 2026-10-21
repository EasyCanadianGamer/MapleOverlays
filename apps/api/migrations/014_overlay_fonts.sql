CREATE TABLE IF NOT EXISTS overlay_fonts (
  id             UUID PRIMARY KEY,
  twitch_user_id TEXT NOT NULL REFERENCES channels(twitch_user_id) ON DELETE CASCADE,
  family         TEXT NOT NULL,
  format         TEXT NOT NULL CHECK (format IN ('woff2', 'woff', 'ttf', 'otf')),
  data           BYTEA NOT NULL,
  size_bytes     INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overlay_fonts_channel ON overlay_fonts(twitch_user_id);
