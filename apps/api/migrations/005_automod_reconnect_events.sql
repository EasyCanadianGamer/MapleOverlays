ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS automod_settings      JSONB       NOT NULL DEFAULT '[true,true,true,false]',
  ADD COLUMN IF NOT EXISTS reconnect_requested_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS channel_events (
  id              SERIAL PRIMARY KEY,
  channel_user_id TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,
  user_login      TEXT,
  extra_data      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS channel_events_channel_time_idx
  ON channel_events (channel_user_id, created_at DESC);
