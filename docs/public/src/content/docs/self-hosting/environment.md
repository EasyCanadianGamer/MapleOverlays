---
title: Environment Variables
description: Full reference for all MapleOverlays environment variables.
---


All variables live in a single `.env` file at the repository root. Copy `.env.example` to get started.

<Aside type="tip">
Variables prefixed with `VITE_` are baked into the frontend bundle at build time. If you change them you must rebuild the frontend image.
</Aside>

## Required Variables

These must be set before starting the stack.

### Twitch

| Variable | Used by | Description |
|----------|---------|-------------|
| `TWITCH_CLIENT_ID` | api, bot | Your app's client ID from the Twitch Developer Console |
| `TWITCH_CLIENT_SECRET` | api | Your app's client secret (never exposed to the frontend) |
| `TWITCH_BOT_CALLBACK_URI` | api | Full URL of the bot OAuth callback — e.g. `https://your-domain.com/auth/bot/callback` |
| `BOT_USER_ID` | bot | Twitch user ID of the bot account (not the broadcaster) |
| `BOT_ACCESS_TOKEN` | bot | OAuth access token for the bot account — requires `user:bot` + `user:write:chat` scopes |
| `VITE_TWITCH_CLIENT_ID` | frontend | Same client ID — baked into the SPA at build time |
| `VITE_TWITCH_REDIRECT_URI` | frontend | Frontend OAuth callback — e.g. `https://your-domain.com/auth/twitch/callback` |

### Database

| Variable | Used by | Description |
|----------|---------|-------------|
| `DATABASE_URL` | api, bot | Full Postgres connection string — e.g. `postgresql://maple:password@postgres:5432/maple` |
| `POSTGRES_USER` | postgres | Database username (default: `maple`) |
| `POSTGRES_PASSWORD` | postgres | **Required.** Database password — choose a strong value |
| `POSTGRES_DB` | postgres | Database name (default: `maple`) |

### Security

| Variable | Used by | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | api, bot | 64-character hex string — encrypts all stored OAuth tokens. Generate with `openssl rand -hex 32` |

### URLs

| Variable | Used by | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | api, bot | The public URL of the frontend — used for CORS and OAuth redirects. e.g. `https://your-domain.com` |
| `VITE_API_URL` | frontend | The public URL of the frontend — baked into the SPA. Set to the same value as `FRONTEND_URL` e.g. `https://your-domain.com` |
| `VITE_DOC_URL` | frontend | The public URL of the docs site — baked into the SPA. e.g. `https://docs.your-domain.com` |

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LASTFM_API_KEY` | — | Last.fm API key — required for `!song` command and now-playing overlay |
| `API_PORT` | `3099` | Host port for the API container |
| `FRONTEND_PORT` | `5173` | Host port for the frontend container |
| `DOCS_PORT` | `4321` | Host port for the docs container |
| `DB_POOL_MAX` | `10` | Max Postgres connections in the bot's pool |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Idle connection timeout in the bot's pool |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Timeout when acquiring a connection from the pool |
| `DB_STATEMENT_TIMEOUT_MS` | `10000` | Max time a single query can run before being cancelled |

## Getting a Bot Access Token

The `BOT_ACCESS_TOKEN` is a user token for the bot's own Twitch account (not a broadcaster token). To obtain one:

1. Start the API server
2. Visit `https://your-domain.com/bot/token-helper` in your browser (or `http://localhost:3099/bot/token-helper` if testing locally)
3. Complete the Twitch OAuth flow for the bot account
4. Copy the displayed `BOT_ACCESS_TOKEN=...` value into `.env`

The token requires the `user:bot` and `user:write:chat` scopes. It **does not expire automatically** but can be revoked from the bot account's Twitch connections page.
