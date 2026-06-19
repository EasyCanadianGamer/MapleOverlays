# Bot Timers & Counters — Design Spec

**Date:** 2026-06-16  
**Status:** Approved

---

## Overview

Two new bot automation features:

- **Timers** — auto-post messages to chat on a configurable schedule (online interval, offline interval, minimum chat lines gate)
- **Counters** — per-command use counters via `{count}` and `{getcount}` template variables, manageable from the dashboard

Both features nest under the Bot section in the sidebar as new sub-pages.

---

## Database

### Migration 007 — `apps/api/migrations/007_timers_counters.sql`

```sql
CREATE TABLE IF NOT EXISTS bot_timers (
  id               SERIAL PRIMARY KEY,
  twitch_user_id   TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  message          TEXT        NOT NULL,
  online_interval  INT         NOT NULL DEFAULT 0,  -- seconds; 0 = disabled when live
  offline_interval INT         NOT NULL DEFAULT 0,  -- seconds; 0 = disabled when offline
  chat_lines       INT         NOT NULL DEFAULT 0,  -- min chat messages required since last fire
  enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  last_fired_at    TIMESTAMPTZ,
  UNIQUE (twitch_user_id, name)
);

ALTER TABLE command_configs ADD COLUMN IF NOT EXISTS count INT NOT NULL DEFAULT 0;
```

**Intervals are stored in seconds.** The frontend displays and accepts minutes; it converts on save.

---

## Bot Process (`apps/bot/src/`)

### Timer loop — `index.js`

- On startup, start a `setInterval` that ticks every **60 seconds**.
- Each tick queries `bot_timers WHERE twitch_user_id = ANY($1)` where `$1` is the array of channel IDs currently subscribed in `EventSubManager` (the authoritative list of channels the bot is serving).
- For each timer, fire if **all** conditions are met:
  1. Timer is `enabled`
  2. Stream is live → `online_interval > 0` and `Date.now() - last_fired_at >= online_interval * 1000`  
     Stream is offline → `offline_interval > 0` and `Date.now() - last_fired_at >= offline_interval * 1000`
  3. In-memory chat line count for that channel since last fire ≥ `chat_lines`
- On fire: call `sendMessage`, then `UPDATE bot_timers SET last_fired_at = NOW() WHERE id = $1`.
- Reset that channel's chat line checkpoint for this timer after firing.

### Chat line tracking — `index.js`

Add two in-memory Maps alongside the existing `sessionMap`:

```js
const chatLineCount = new Map();       // broadcasterId → total message count
const timerChatCheckpoint = new Map(); // timerId → chatLineCount at last fire
```

Increment `chatLineCount[broadcasterId]` on every incoming `channel.chat.message` event (before command dispatch). On timer fire, set `timerChatCheckpoint[timerId] = chatLineCount[broadcasterId]`.

Chat line counts reset on bot restart — acceptable, timers fall back to interval-only gating until chat activity rebuilds.

### Counter template variables — `template.js`

Add two new variables to `resolveTemplate`:

| Variable | Behaviour |
|---|---|
| `{count}` | `UPDATE command_configs SET count = count + 1 WHERE twitch_user_id = $1 AND command = $2 RETURNING count` — returns the new count |
| `{getcount commandname}` | `SELECT count FROM command_configs WHERE twitch_user_id = $1 AND command = $2` — returns count without incrementing |

Both are lazy (only executed if present in the template string). The command name for `{count}` comes from `ctx` — add `command` to the context object passed from `index.js` to `handleCommand` and on to `resolveTemplate`.

---

## API Routes — `apps/api/src/routes/bot.js`

### Timers

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/bot/timers` | Bearer | List all timers for caller's channel |
| POST | `/bot/timers` | Bearer | Create a timer |
| PUT | `/bot/timers/:id` | Bearer | Update a timer (IDOR: verify timer belongs to caller) |
| DELETE | `/bot/timers/:id` | Bearer | Delete a timer (IDOR check) |

Request body for POST/PUT:
```json
{
  "name": "Social Links",
  "message": "Follow us on Twitter @maple!",
  "online_interval": 900,
  "offline_interval": 0,
  "chat_lines": 5,
  "enabled": true
}
```

Validation: `name` ≤ 50 chars, `message` ≤ 500 chars, intervals ≥ 0, `chat_lines` ≥ 0, max 20 timers per channel.

### Counters

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/bot/counters` | Bearer | `SELECT command, response, count FROM command_configs WHERE twitch_user_id = $1 AND response LIKE '%{count}%'` — returns counter commands with current values |
| PUT | `/bot/counters/:command` | Bearer | Set `{ count: number }` — used for dashboard +/−/reset/set |

`PUT /bot/counters/:command` validates count ≥ 0 and that the command belongs to the caller's channel.

---

## Frontend

### Navigation changes

**`Sidebar.tsx`** — add to `BOT_SUB_ITEMS`:
```ts
{ id: 'bot-timers',   icon: 'timer', label: 'Timers'   },
{ id: 'bot-counters', icon: 'hash',  label: 'Counters' },
```

**`DashboardLayout.tsx`** — extend `ViewId`, `pathnameToView`, `viewToPath`, and `views`:
- `bot-timers` ↔ `/dashboard/bot/timers`
- `bot-counters` ↔ `/dashboard/bot/counters`

### `BotTimers.tsx`

State: `timers[]`, `editingId | null`, `editDraft`, `isCreating`.

- Timer list: one row per timer — enabled toggle, name, truncated message, online interval, offline interval, chat lines, Edit button, Delete button.
- Edit inline: clicking Edit sets `editingId` and renders an expanded form below the row with all fields. Interval inputs accept **minutes** (converted to seconds on save). Offline interval of 0 means "don't post when offline".
- Create: "+ New Timer" button renders the same form below the list with blank fields.
- Save: `POST /bot/timers` (create) or `PUT /bot/timers/:id` (update).
- Delete: `DELETE /bot/timers/:id` with confirm.

### `BotCounters.tsx`

State: `counters[]` (commands with `{count}` in response + their current `count`), `settingId | null`, `setDraft`.

- Counter list: one row per counter command — command name (`!deaths`), response preview with `{count}` highlighted, current count value, − button, + button, Set button (inline input), Reset button.
- `GET /bot/counters` on mount to populate.
- +/− and Reset all call `PUT /bot/counters/:command` with the updated value.
- Set: clicking "Set" shows an inline number input; confirm calls the same endpoint.
- "+ New Counter Command": opens a create form (reuses BotCommands create flow) with `{count}` pre-filled in the response.

---

## Verification

1. Create a timer with online interval 1 min, chat lines 0 — wait for bot to fire it in chat.
2. Create a `!deaths` command with response `We have died {count} times` — type `!deaths` in chat, verify count increments.
3. Create a `!deathcheck` command with response `Deaths so far: {getcount deaths}` — verify it reads without incrementing.
4. Dashboard +/−/Reset buttons update the displayed count and reflect in chat on next use.
5. `docker compose up --build` — all services build cleanly with migration 007 applied on API startup.
