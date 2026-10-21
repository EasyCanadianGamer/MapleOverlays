CREATE TABLE IF NOT EXISTS channels (
  id              SERIAL PRIMARY KEY,
  twitch_user_id  TEXT NOT NULL UNIQUE,
  twitch_login    TEXT NOT NULL,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  invited_at      TIMESTAMPTZ DEFAULT NOW(),
  bot_active      BOOLEAN DEFAULT FALSE
);
