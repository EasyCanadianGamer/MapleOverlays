CREATE TABLE IF NOT EXISTS command_configs (
  id             SERIAL PRIMARY KEY,
  twitch_user_id TEXT    NOT NULL,
  command        TEXT    NOT NULL,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  response       TEXT,
  UNIQUE (twitch_user_id, command)
);

CREATE TABLE IF NOT EXISTS watchtimes (
  id              SERIAL PRIMARY KEY,
  channel_user_id TEXT NOT NULL,
  viewer_login    TEXT NOT NULL,
  total_seconds   INT  NOT NULL DEFAULT 0,
  UNIQUE (channel_user_id, viewer_login)
);
