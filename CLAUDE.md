# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MapleOverlays is a streamer overlay service. It connects to Twitch (via a bot and frontend OAuth) and Last.fm (for now-playing data) to display live overlays for streamers.

## Monorepo Structure

pnpm workspaces. All `apps/*`, `packages/*`, and `docs/*` are workspace members.

```
apps/
  api/        Express server — bot OAuth, command CRUD, settings, /nowplaying proxy
  bot/        Twitch EventSub WebSocket bot (Helix API for sending messages)
  frontend/   React + Vite SPA (TypeScript)
packages/
  lastfm/     getNowPlaying(username) + getNowPlayingData(username) — wraps Last.fm REST API
  shared/     Placeholder — shared utilities (currently empty)
docs/
  public/     Astro + Starlight documentation site (@maple/docs)
test-docker/  Postgres-only docker-compose for local dev
```

## Common Commands

All commands run from the repo root unless noted. Requires Node.js >=22.12.0 and pnpm >=9.

```bash
pnpm install                  # install all workspace deps

# Per-app dev (from app directory)
cd apps/api && pnpm dev       # Express API on :3000
cd apps/bot && pnpm dev       # Twitch bot
cd apps/frontend && pnpm dev  # Vite on :5173

# Run migrations only (from apps/api)
cd apps/api && pnpm migrate

# Docs (from docs/public directory)
cd docs/public && pnpm dev    # Astro Starlight on :4321
cd docs/public && pnpm build  # Static output to docs/public/dist/

# Run bot unit tests (node:test, no external runner)
cd apps/bot && pnpm test

# Run a single bot test file
cd apps/bot && node --test test/commands.test.js

# Run lastfm package tests
cd packages/lastfm && pnpm test

# TypeScript type-check (frontend only — no build output)
cd apps/frontend && npx tsc --noEmit

# Build frontend for production (SPA — outputs to apps/frontend/dist/)
cd apps/frontend && pnpm build

# The frontend has no test runner configured (no Vitest/Jest)

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
| `BOT_ACCESS_TOKEN` | bot (requires `user:bot` + `user:write:chat` + `moderator:manage:chat_messages` + `moderator:manage:banned_users` scopes) |
| `TWITCH_BOT_CALLBACK_URI` | api (OAuth redirect — must match dev.twitch.tv registration, e.g. `http://localhost:3000/auth/bot/callback`) |
| `ENCRYPTION_KEY` | api, bot (64-char hex — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `VITE_TWITCH_CLIENT_ID` / `VITE_TWITCH_REDIRECT_URI` | frontend |
| `DATABASE_URL` | api, bot |
| `VITE_API_URL` | frontend |
| `FRONTEND_URL` | api (CORS origin + !commands URL) |
| `PORT` | api (HTTP listen port — defaults to `3000`) |

Both `api/src/crypto.js` and `bot/src/crypto.js` throw on startup if `ENCRYPTION_KEY` is missing or not 64 hex chars.

## Database & Migrations

Postgres only, accessed via `DATABASE_URL`. The API runs migrations on startup via `apps/api/src/migrate.js`, which tracks completed files in a `_migrations` table and wraps each file in a transaction.

Migration files live in `apps/api/migrations/`. The bot has no migration runner — the API must start first on a fresh DB.

Schema overview:
- `channels` — one row per broadcaster who invited the bot; `access_token`/`refresh_token` stored AES-256-GCM encrypted; `automod_settings` is a JSONB boolean array `[links, caps, emoteSpam, firstTimeWarn]`; `reconnect_requested_at` is polled by the bot to trigger EventSub reconnect; `nowplaying_triggered_at` is stamped by the bot when `!song` is used and polled by the Now Playing overlay to force-show immediately
- `command_configs` — per-channel command overrides (enabled flag + custom response template)
- `watchtimes` — accumulated viewer watchtime in seconds per channel
- `channel_events` — activity feed log; `event_type` values: `follow`, `sub`, `cheer`, `raid`, `mod_action`; indexed by `(channel_user_id, created_at DESC)`

For local dev without full Docker, run just the DB:

```bash
cd test-docker && POSTGRES_PASSWORD=yourpassword docker compose up -d
```

## API Routes

Routes are split between two files:
- `apps/api/src/index.js` — `/nowplaying`, `/nowplaying/json`, `/bot/token-helper`
- `apps/api/src/routes/bot.js` — all authenticated/bot routes

| Method | Path | Description |
|---|---|---|
| GET | `/nowplaying?user=<lastfm>` | Now-playing text |
| GET | `/nowplaying/json?user=<lastfm>` | Now-playing structured data `{ isPlaying, track, artist, album, albumArt }` |
| GET | `/nowplaying/triggered?channel=<login>` | Returns `{ triggered_at }` timestamp — polled by the overlay to detect `!song` triggers (public, no auth) |
| GET | `/auth/bot/callback` | Twitch OAuth callback — exchanges code, encrypts + stores tokens |
| GET | `/bot/status` | Returns `{ invited, active }` for the caller's channel |
| GET | `/bot/commands` | Lists command configs for the caller's channel |
| PUT | `/bot/commands` | Create/update a command config |
| DELETE | `/bot/commands/:command` | Delete a custom command |
| GET | `/settings` | Returns `{ lastfm_username, tip_url }` |
| PUT | `/settings` | Updates `lastfm_username` and/or `tip_url` |
| GET | `/channels/:login/commands` | Public — lists enabled commands for a streamer |
| POST | `/bot/reconnect` | Sets `reconnect_requested_at` on channel row; bot polls this to reconnect EventSub |
| GET | `/bot/activity` | Returns recent `channel_events` rows for the caller's channel |
| GET | `/bot/automod` | Returns `automod_settings` array for the caller's channel |
| PUT | `/bot/automod` | Updates `automod_settings` array |
| GET | `/bot/token-helper` | HTML page that extracts `BOT_ACCESS_TOKEN` from the OAuth fragment (dev utility) |

Routes that mutate data call `getCallerTwitchId()` to verify the Bearer token against Twitch's `/helix/users` endpoint and check IDOR.

## Bot Architecture

The bot (`apps/bot/src/index.js`) uses Twitch EventSub WebSocket to receive chat messages and the Helix API (`sendMessage` in `twitch.js`) to reply. It is multi-tenant — a single process serves all channels that have invited the bot.

**Key modules:**
- `eventsub.js` — `EventSubManager` class: manages one persistent WebSocket, subscribes to `channel.chat.message` per channel, handles reconnect with exponential backoff
- `commands.js` — `handleCommand(message, ctx)` — pure command dispatcher; returns the reply string or `null`
- `template.js` — `resolveTemplate(template, ctx)` — async template substitution (see Template Variables below)
- `twitch.js` — Helix API wrappers: `sendMessage`, `deleteMessage`, `timeoutUser` (automod enforcement); `getBroadcasterStream`, `getChannelInfo`, `getFollowAge`, `getSubAge`, `getUserCreatedAt`, `getUserIdByLogin`
- `crypto.js` — `decrypt(ciphertext)` only — AES-256-GCM using the shared `ENCRYPTION_KEY`
- `db.js` — pg Pool with configurable limits via `DB_POOL_MAX` / `DB_IDLE_TIMEOUT_MS` / etc.

**In-process state:**
- `configCache` (Map) — caches per-channel DB config for 60s to reduce DB queries
- `sessionMap` (Map) — tracks viewer chat session start times for watchtime accounting; flushed on stream-offline and on SIGINT/SIGTERM

**Automod enforcement** (`enforceAutoMod` in `bot/src/index.js`): runs on every chat message before command dispatch. Checks `automod_settings[0..3]`: link filter (deletes message), caps tax (30s timeout), emote spam (30s timeout), first-time message hold (logs to `channel_events` as `mod_action`). Requires `deleteMessage` and `timeoutUser` Helix API calls with bot's own token — bot user must be a channel moderator.

**Now Playing trigger**: after a successful `!song` reply, the bot fire-and-forgets `UPDATE channels SET nowplaying_triggered_at = NOW()`. The `NowPlayingOverlay` component polls `GET /nowplaying/triggered` every 5 s and force-shows the card when it sees a new timestamp.

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
- `/login` → `AuthGate.tsx` (redirects to Twitch OAuth if not authenticated)
- `/dashboard` → `DashboardLayout.tsx` (wraps dashboard sub-pages via nested routes)
- `/auth/twitch/callback` → `TwitchCallback.tsx`
- `/overlays/:id` → `OverlaySource.tsx` (transparent OBS browser-source URL; `id=nowplaying` renders `NowPlayingOverlay.tsx` directly and skips Twitch EventSub entirely)
- `/commands/:login` → `CommandsList.tsx` (public viewer-facing command list)

Dashboard sub-pages (rendered inside `DashboardLayout`): `Bot.tsx`, `BotCommands.tsx`, `BotModerator.tsx`, `BotSettings.tsx`, `Overlays.tsx`, `Settings.tsx`, `StreamManager.tsx`.

Twitch auth is implicit OAuth flow — token stored in `localStorage` via `src/lib/twitchAuth.ts`. Components that need the user call `useTwitchAuth`. Frontend env vars must be prefixed `VITE_` to be accessible at `import.meta.env.VITE_*`.

**Hooks** (`src/hooks/`): `useTwitchAuth` — current Twitch user + token; `useStreamInfo` — live stream metadata; `useTwitchStats` — follow/sub counts and channel stats.

**Components** (`src/components/`):
- `layout/` — `DashboardLayout` (nested route shell), `Sidebar`, `TopBar`
- `ui/` — shared primitives: `Button`, `Card`, `Toggle`, `Icon`, `LivePill`, `TierBadge`, `Eyebrow`, `MapleMark`

Overlay pages inject a `<style>` tag synchronously in `main.tsx` (before React renders) to set `background: transparent` for OBS — this cannot be done in a `useEffect` because the first paint would be non-transparent.

**Overlay frontend libs** (used by `OverlaySource.tsx`):
- `lib/eventSub.ts` — client-side Twitch EventSub WebSocket; subscribes to `channel.follow`, `channel.subscribe`, `channel.cheer`, `channel.raid` using the viewer's token and a session ID; each overlay type has a fixed subscription config in `SUBS`
- `lib/twitchChat.ts` — lightweight TMI WebSocket client for reading live chat in overlay pages
- `lib/sounds.ts` — plays notification sounds for overlay events
- `lib/twitchApi.ts` — Helix API helpers used by the frontend (stream info, user lookup)

**Now Playing overlay** (`NowPlayingOverlay.tsx`): self-contained component rendered when `id === 'nowplaying'`. Manages its own 4-state machine (`hidden → entering → visible → exiting`), polls `GET /nowplaying/json` on a configurable interval, and additionally polls `GET /nowplaying/triggered` every 5 s to force-show when `!song` is used in chat. All config comes from URL params (`user`, `channel`, `duration`, `corner`, `from`, `color`, `font`, `fcolor`, `style`, `poll`). CSS keyframes for the animations live in `src/styles/global.css` as `np-card-enter-*`, `np-art-pop`, `np-text-reveal-*`, `np-card-exit-*`.

## Token Encryption

Tokens stored in the `channels` table are AES-256-GCM encrypted. The wire format (base64) is: 12-byte IV ‖ 16-byte GCM auth tag ‖ ciphertext. If a channel's token fails to decrypt, the bot logs a warning and that channel's access-dependent commands (`!followage`) silently return `null` until the channel re-authorizes.

## Documentation Site

`docs/public/` is an Astro + Starlight static documentation site (`@maple/docs`). Content lives in `docs/public/src/content/docs/` as `.md`/`.mdx` files with file-based routing. The sidebar is configured in `docs/public/astro.config.mjs`.

| Path | URL slug | Purpose |
|---|---|---|
| `src/content/docs/index.mdx` | `/` | Introduction / welcome |
| `src/content/docs/guides/bot-setup.md` | `/guides/bot-setup/` | Inviting the bot, OAuth |
| `src/content/docs/guides/overlays.md` | `/guides/overlays/` | OBS overlay setup |
| `src/content/docs/reference/commands.md` | `/reference/commands/` | Built-in command reference |
| `src/content/docs/reference/template-variables.md` | `/reference/template-variables/` | Template variable reference |
| `src/content/docs/self-hosting/index.md` | `/self-hosting/` | Self-hosting overview + requirements |
| `src/content/docs/self-hosting/docker.md` | `/self-hosting/docker/` | Docker Compose step-by-step |
| `src/content/docs/self-hosting/environment.md` | `/self-hosting/environment/` | Full env var reference |

Brand assets (fonts, logo, favicon) are copied from `apps/frontend/src/` into `docs/public/public/fonts/` and `docs/public/src/assets/`. Theme overrides live in `docs/public/src/styles/custom.css`.

Dev server runs on port 4321. Build output goes to `docs/public/dist/` and can be deployed as a standalone static site independently of the other apps.
