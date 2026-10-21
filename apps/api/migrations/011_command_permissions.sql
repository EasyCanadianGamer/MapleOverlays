ALTER TABLE command_configs
  ADD COLUMN IF NOT EXISTS min_role TEXT NOT NULL DEFAULT 'everyone'
  CHECK (min_role IN ('everyone', 'subscriber', 'vip', 'moderator', 'broadcaster'));
