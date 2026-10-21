ALTER TABLE channels ADD COLUMN IF NOT EXISTS nowplaying_triggered_at TIMESTAMPTZ;
