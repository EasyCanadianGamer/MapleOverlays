# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MapleOverlays is a streamer overlay service. It connects to Twitch (via a bot and frontend OAuth) and Last.fm (for now-playing data) to display live overlays for streamers.

## Monorepo Structure

pnpm workspaces. All `apps/*` and `packages/*` are workspace members.

```
apps/
  api/        Express server — bot OAuth, command CRUD, settings, /nowplaying proxy
  bot/        Twitch EventSub WebSocket bot (Helix API for sending messages)
  frontend/   React + Vite SPA (TypeScript)
packages/
  lastfm/     getNowPlaying(username) — wraps Last.fm REST API
  shared/     Placeholder — shared utilities (currently empty)
test-docker/  Postgres-only docker-compose for local dev
```

## Common Commands

All commands run from the repo root unless noted.

```bash
pnpm install                  # install all workspace deps

# Per-app dev (from app directory)
cd apps/api && pnpm dev       # Express API on :3000
cd apps/bot && pnpm dev       # Twitch bot
cd apps/frontend && pnpm dev  # Vite on :5173

# Run migrations only (from apps/api)
cd apps/api && pnpm migrate

# Full stack
docker compose up --build
```

The `api` and `bot` apps use `--env-file-if-exists=../../.env` so they read the single root `.env` when run from their own directory. The frontend uses Vite's built-in `.env` loading — no flag needed.

## Environment Variables

Copy `.env.example` to `.env` at the repo root. Key variables:

| Variable | Used by |
|---|---|
| `LASTFM_API_KEY` | api |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | api, bot |
| `BOT_USER_ID` | bot |
| `BOT_ACCESS_TOKEN` | bot (requires `user:bot` + `user:write:chat` scopes) |
| `ENCRYPTION_KEY` | api, bot (64-char hex — generate: `openssl rand -hex 32`) |
| `VITE_TWITCH_CLIENT_ID` / `VITE_TWITCH_REDIRECT_URI` | frontend |
| `DATABASE_URL` | api, bot |
| `VITE_API_URL` | frontend |
| `FRONTEND_URL` | api (CORS origin + !commands URL) |

Both `api/src/crypto.js` and `bot/src/crypto.js` throw on startup if `ENCRYPTION_KEY` is missing or not 64 hex chars.

## Database & Migrations

Postgres only, accessed via `DATABASE_URL`. The API runs migrations on startup via `apps/api/src/migrate.js`, which tracks completed files in a `_migrations` table and wraps each file in a transaction.

Migration files live in `apps/api/migrations/`. The bot has no migration runner — the API must start first on a fresh DB.

Schema overview:
- `channels` — one row per broadcaster who invited the bot; `access_token`/`refresh_token` stored AES-256-GCM encrypted
- `command_configs` — per-channel command overrides (enabled flag + custom response template)
- `watchtimes` — accumulated viewer watchtime in seconds per channel

For local dev without full Docker, run just the DB:

```bash
cd test-docker && POSTGRES_PASSWORD=yourpassword docker compose up -d
```

## API Routes

All routes are in `apps/api/src/routes/bot.js`:

| Method | Path | Description |
|---|---|---|
| GET | `/nowplaying?user=<lastfm>` | Now-playing text (in `api/src/index.js`) |
| GET | `/auth/bot/callback` | Twitch OAuth callback — exchanges code, encrypts + stores tokens |
| GET | `/bot/status` | Returns `{ invited, active }` for the caller's channel |
| GET | `/bot/commands` | Lists command configs for the caller's channel |
| PUT | `/bot/commands` | Create/update a command config |
| DELETE | `/bot/commands/:command` | Delete a custom command |
| GET | `/settings` | Returns `{ lastfm_username, tip_url }` |
| PUT | `/settings` | Updates `lastfm_username` and/or `tip_url` |
| GET | `/channels/:login/commands` | Public — lists enabled commands for a streamer |
| POST | `/bot/reconnect` | Triggers bot EventSub reconnect (stub) |

Routes that mutate data call `getCallerTwitchId()` to verify the Bearer token against Twitch's `/helix/users` endpoint and check IDOR.

## Bot Architecture

The bot (`apps/bot/src/index.js`) uses Twitch EventSub WebSocket to receive chat messages and the Helix API (`sendMessage` in `twitch.js`) to reply. It is multi-tenant — a single process serves all channels that have invited the bot.

**Key modules:**
- `eventsub.js` — `EventSubManager` class: manages one persistent WebSocket, subscribes to `channel.chat.message` per channel, handles reconnect with exponential backoff
- `commands.js` — `handleCommand(message, ctx)` — pure command dispatcher; returns the reply string or `null`
- `template.js` — `resolveTemplate(template, ctx)` — async template substitution (see Template Variables below)
- `twitch.js` — Helix API wrappers (`getBroadcasterStream`, `getFollowAge`, `getUserCreatedAt`, `sendMessage`, etc.)
- `crypto.js` — `decrypt(ciphertext)` only — AES-256-GCM using the shared `ENCRYPTION_KEY`
- `db.js` — pg Pool with configurable limits via `DB_POOL_MAX` / `DB_IDLE_TIMEOUT_MS` / etc.

**In-process state:**
- `configCache` (Map) — caches per-channel DB config for 60s to reduce DB queries
- `sessionMap` (Map) — tracks viewer chat session start times for watchtime accounting; flushed on stream-offline and on SIGINT/SIGTERM

## Adding Bot Commands

Commands are dispatched in `apps/bot/src/commands.js`. The `handleCommand` function checks built-in commands first, then falls back to any custom command in `commandConfigs` that has a response template.

To add a new built-in command, add a block to `handleCommand`:

```js
if (text === '!newcmd') {
  const { enabled, response } = cfg('newcmd');
  if (!enabled) return null;
  return resolveTemplate(response ?? 'default reply', ctx);
}
```

Also add it to `BUILTIN_COMMANDS` in `apps/api/src/routes/bot.js` so the API protects it from deletion.

## Template Variables

Response templates use `{variable}` syntax. `resolveTemplate` in `apps/bot/src/template.js` resolves these lazily (only fetches APIs for variables actually used in the template):

| Variable | Value |
|---|---|
| `{channel}` | Broadcaster's login |
| `{user}` | Chatter's login |
| `{1}` | First word after the command (argument) |
| `{game}` / `{channel.game}` | Current game (falls back to channel info if offline) |
| `{channel.viewers}` | Current viewer count |
| `{1.game}` | Game of the streamer named in `{1}` |
| `{user.follow}` | How long the chatter has been following |
| `{user.subscribe}` | Chatter's sub tier or `[not subscribed]` |

## Frontend Architecture

React Router with these top-level routes:
- `/` → `Landing.tsx`
- `/dashboard` → `DashboardLayout.tsx` (wraps dashboard sub-pages via nested routes)
- `/auth/twitch/callback` → `TwitchCallback.tsx`
- `/overlays/:id` → `OverlaySource.tsx` (transparent OBS browser-source URL)
- `/commands/:login` → `CommandsList.tsx` (public viewer-facing command list)

Dashboard sub-pages (rendered inside `DashboardLayout`): `Bot.tsx`, `BotCommands.tsx`, `BotModerator.tsx`, `BotSettings.tsx`, `Overlays.tsx`, `Settings.tsx`, `StreamManager.tsx`.

Twitch auth is implicit OAuth flow — token stored in `localStorage` via `src/lib/twitchAuth.ts`. Components that need the user call `useTwitchAuth`. Frontend env vars must be prefixed `VITE_` to be accessible at `import.meta.env.VITE_*`.

Overlay pages inject a `<style>` tag synchronously in `main.tsx` (before React renders) to set `background: transparent` for OBS — this cannot be done in a `useEffect` because the first paint would be non-transparent.

## Token Encryption

Tokens stored in the `channels` table are AES-256-GCM encrypted. The wire format (base64) is: 12-byte IV ‖ 16-byte GCM auth tag ‖ ciphertext. If a channel's token fails to decrypt, the bot logs a warning and that channel's access-dependent commands (`!followage`) silently return `null` until the channel re-authorizes.
