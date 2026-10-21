CREATE TABLE IF NOT EXISTS bot_timers (
  id               SERIAL      PRIMARY KEY,
  twitch_user_id   TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  message          TEXT        NOT NULL,
  online_interval  INT         NOT NULL DEFAULT 0,
  offline_interval INT         NOT NULL DEFAULT 0,
  chat_lines       INT         NOT NULL DEFAULT 0,
  enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  last_fired_at    TIMESTAMPTZ,
  UNIQUE (twitch_user_id, name)
);

ALTER TABLE command_configs ADD COLUMN IF NOT EXISTS count INT NOT NULL DEFAULT 0;
