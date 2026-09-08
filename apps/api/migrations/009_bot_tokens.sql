CREATE TABLE IF NOT EXISTS bot_tokens (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
