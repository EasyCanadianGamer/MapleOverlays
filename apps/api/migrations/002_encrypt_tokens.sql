-- NOTE: Existing rows with plaintext tokens will fail to decrypt after this migration.
-- Any channels that previously invited the bot must re-do the OAuth flow to re-encrypt their tokens.
-- updated_at for existing rows will be set to migration time, not their actual last-updated time.
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS channels_twitch_login_idx ON channels (twitch_login);
