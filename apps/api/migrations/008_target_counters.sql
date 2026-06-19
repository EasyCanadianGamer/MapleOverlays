CREATE TABLE IF NOT EXISTS command_target_counts (
  id             SERIAL      PRIMARY KEY,
  twitch_user_id TEXT        NOT NULL,
  command        TEXT        NOT NULL,
  target         TEXT        NOT NULL,
  count          INT         NOT NULL DEFAULT 0,
  UNIQUE (twitch_user_id, command, target)
);
