# Bot Invite Flow Design

**Date:** 2026-06-11  
**Status:** Approved

## Overview

Migrate the Twitch bot from `tmi.js` (IRC) to the modern Helix Chat API + EventSub, and add a self-serve invite flow so any logged-in streamer can add `maple_bot` to their channel from the dashboard. The bot badge displays automatically when using the new API with an app access token.

## Database Schema

New `channels` table in Postgres:

```sql
CREATE TABLE channels (
  id              SERIAL PRIMARY KEY,
  twitch_user_id  TEXT NOT NULL UNIQUE,
  twitch_login    TEXT NOT NULL,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  invited_at      TIMESTAMPTZ DEFAULT NOW(),
  bot_active      BOOLEAN DEFAULT FALSE
);
```

`bot_active` is flipped to `true` by the bot after it successfully subscribes to EventSub for that channel. The frontend polls this to transition from "pending" to "connected" state.

## Architecture

```
Browser (frontend)
  │  1. Clicks "Invite Bot"
  │  2. Redirected to Twitch OAuth (channel:bot scope, response_type=code)
  │  3. Twitch redirects to API callback
  ▼
API (Express)
  │  4. Exchanges code → stores row in channels table
  │  5. Redirects browser back to /dashboard/bot?invited=true
  │  6. Exposes GET /bot/status?channel=<login>
  ▼
Postgres
  ▲
  │  7. Bot polls every 30s for rows where bot_active = false
Bot (rewritten)
     8. Subscribes to EventSub channel.chat.message for each new channel
     9. Sends messages via POST /helix/chat/messages (app access token)
    10. Flips bot_active = true
```

## Environment Variables

| Variable | App | Purpose |
|---|---|---|
| `TWITCH_CLIENT_ID` | API, Bot | App client ID (server-side, not the frontend's public one) |
| `TWITCH_CLIENT_SECRET` | API, Bot | For code exchange and app access token |
| `TWITCH_BOT_CALLBACK_URI` | API | e.g. `http://localhost:3000/auth/bot/callback` |
| `FRONTEND_URL` | API | e.g. `http://localhost:5173` — used to redirect browser back after OAuth |
| `BOT_USER_ID` | Bot | `maple_bot`'s numeric Twitch user ID |
| `BOT_ACCESS_TOKEN` | Bot | `maple_bot`'s user token with `user:bot` scope — obtain by doing a manual OAuth on the bot account at dev.twitch.tv with `user:bot` scope |

`VITE_TWITCH_CLIENT_ID` and `VITE_API_URL` are already set in the frontend and remain unchanged.

## OAuth Invite Flow

The frontend builds the Twitch OAuth URL client-side (same pattern as existing user auth) with:
- `response_type=code` (authorization code flow, not implicit)
- `scope=channel:bot`
- `redirect_uri` pointing to the API (`TWITCH_BOT_CALLBACK_URI`)

**New API endpoints:**

### `GET /auth/bot/callback`
Query params: `code`

1. Exchanges `code` for `access_token` + `refresh_token` via Twitch token endpoint
2. Fetches streamer's user info (`GET /helix/users`) to get `twitch_user_id` and `twitch_login`
3. Upserts row in `channels` table
4. Redirects to `${FRONTEND_URL}/dashboard/bot?invited=true`

> State/CSRF validation is skipped in this MVP — the callback only stores data and is not destructive. Add state cookie validation before launch.

### `GET /bot/status`
Query param: `channel` (twitch login)

Returns:
```json
{ "invited": true, "active": false }
```

## Bot Rewrite

Drops `tmi.js`. New behavior:

**Startup:**
1. Fetch app access token via client credentials (`POST /oauth2/token?grant_type=client_credentials`)
2. Open EventSub WebSocket (`wss://eventsub.wss.twitch.tv/ws`)
3. Load all existing `channels` rows and subscribe to EventSub for each

**Polling loop (every 30s):**
1. `SELECT * FROM channels WHERE bot_active = false`
2. For each new row: subscribe to `channel.chat.message` EventSub, then `UPDATE channels SET bot_active = true`

**Receiving messages:**
EventSub `channel.chat.message` payload replaces `client.on('message', ...)`. Command handling logic (e.g. `!ping`) is identical, just reading from a different event shape.

**Sending messages:**
```
POST https://api.twitch.tv/helix/chat/messages
Authorization: Bearer <app_access_token>
Body: { broadcaster_id, sender_id: BOT_USER_ID, message }
```

Twitch applies the bot badge automatically when this endpoint is used with an app access token and the channel has granted `channel:bot` scope.

**One EventSub WebSocket connection supports up to 300 channel subscriptions** — sufficient for early scale.

## Frontend UI (`Bot.tsx`)

The connection card in the right panel has three states based on `/bot/status` response:

**Not invited** (`invited: false`):
- Label: "Not in your channel"
- Action: "Invite Bot" button → redirects to Twitch OAuth

**Invited, pending** (`invited: true`, `active: false`):
- Label: "Joining your channel..." with muted pulsing indicator
- Frontend polls `/bot/status` every 10s
- This state is entered immediately when the page loads with `?invited=true` in the URL

**Active** (`invited: true`, `active: true`):
- Label: "Connected · twitch.tv/\<login\>" in green
- Action: "Reconnect" button (existing behavior)

The chat preview and auto-mod panels are unchanged.

## Out of Scope

- Bot leaving a channel (manual only for now)
- Token refresh (refresh tokens stored but rotation not implemented yet)
- More than 300 channels (EventSub connection limit — revisit when needed)
