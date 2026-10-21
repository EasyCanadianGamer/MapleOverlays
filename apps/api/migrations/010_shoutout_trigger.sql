ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS shoutout_triggered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shoutout_target         TEXT,
  ADD COLUMN IF NOT EXISTS shoutout_clip_url       TEXT,
  ADD COLUMN IF NOT EXISTS shoutout_display_name   TEXT,
  ADD COLUMN IF NOT EXISTS shoutout_avatar_url     TEXT;
