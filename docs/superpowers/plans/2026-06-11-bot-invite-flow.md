# Bot Invite Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Twitch bot from tmi.js to the Helix Chat API + EventSub, and add a self-serve invite flow so any logged-in streamer can add `maple_bot` to their channel from the dashboard.

**Architecture:** The frontend triggers a Twitch OAuth (`channel:bot` scope, authorization code flow) whose callback lands on the API. The API exchanges the code and upserts a row in the `channels` Postgres table. The bot polls Postgres every 30s for new channels, subscribes to EventSub's `channel.chat.message` event, and sends replies via `POST /helix/chat/messages` with an app access token (which triggers the bot badge automatically). The frontend polls `/bot/status` every 10s after invite to show pending → connected state.

**Tech Stack:** Node.js 18+ (native fetch), Express (API), `pg` (Postgres), `ws` (WebSocket client), React + TypeScript (frontend), `node:test` (bot unit tests)

---

## File Map

**Created:**
- `apps/api/migrations/001_channels.sql` — DB schema
- `apps/api/src/migrate.js` — one-shot migration runner
- `apps/api/src/db.js` — pg Pool for API
- `apps/api/src/routes/bot.js` — `/auth/bot/callback` and `/bot/status`
- `apps/bot/src/db.js` — pg Pool for bot
- `apps/bot/src/commands.js` — pure command handlers
- `apps/bot/src/twitch.js` — app access token + sendMessage
- `apps/bot/src/eventsub.js` — EventSub WebSocket manager
- `apps/bot/test/commands.test.js` — unit tests

**Modified:**
- `.env.example` — add new vars, remove old bot vars
- `apps/api/package.json` — add `pg`, `cors`; add `migrate` script
- `apps/api/src/index.js` — add CORS, mount bot router
- `apps/bot/package.json` — remove `tmi.js`, add `pg`, `ws`; add `test` script
- `apps/bot/src/index.js` — complete rewrite
- `apps/frontend/src/lib/twitchAuth.ts` — add `buildBotAuthUrl()`
- `apps/frontend/src/pages/Bot.tsx` — three-state connection card

---

## Task 1: Environment variables and database migration

**Files:**
- Modify: `.env.example`
- Create: `apps/api/migrations/001_channels.sql`
- Create: `apps/api/src/migrate.js`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Update `.env.example`**

Replace the old bot section and add the new vars. The full file should be:

```
# ── API ──────────────────────────────────────────────────────────────────────
LASTFM_API_KEY=
API_PORT=3000

# ── Bot ──────────────────────────────────────────────────────────────────────
# Same Client ID as VITE_TWITCH_CLIENT_ID — copy that value here
TWITCH_CLIENT_ID=
# Client secret from dev.twitch.tv/console/apps
TWITCH_CLIENT_SECRET=
# Must match the redirect URI registered in your Twitch app settings
TWITCH_BOT_CALLBACK_URI=http://localhost:3000/auth/bot/callback
# maple_bot's numeric Twitch user ID (not the username)
BOT_USER_ID=
# maple_bot's user access token with user:bot scope
# Get it by doing a manual OAuth at dev.twitch.tv with scope=user:bot
BOT_ACCESS_TOKEN=

# ── Frontend ─────────────────────────────────────────────────────────────────
FRONTEND_PORT=5173
# URL the API will redirect the browser back to after bot OAuth
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000

# Twitch OAuth — create an app at https://dev.twitch.tv/console/apps
# Register TWO redirect URIs: VITE_TWITCH_REDIRECT_URI and TWITCH_BOT_CALLBACK_URI
VITE_TWITCH_CLIENT_ID=
VITE_TWITCH_REDIRECT_URI=http://localhost:5173/auth/twitch/callback

# ── Database ─────────────────────────────────────────────────────────────────
POSTGRES_USER=maple
POSTGRES_PASSWORD=
POSTGRES_DB=maple
# Used by api and bot services — update password to match POSTGRES_PASSWORD
DATABASE_URL=postgresql://maple:CHANGE_ME@localhost:5432/maple
```

- [ ] **Step 2: Register the bot callback URI in your Twitch app**

Go to https://dev.twitch.tv/console/apps, open your app, and add `http://localhost:3000/auth/bot/callback` as an OAuth Redirect URL. Both redirect URIs must be registered for local dev to work.

- [ ] **Step 3: Create `apps/api/migrations/001_channels.sql`**

```sql
CREATE TABLE IF NOT EXISTS channels (
  id              SERIAL PRIMARY KEY,
  twitch_user_id  TEXT NOT NULL UNIQUE,
  twitch_login    TEXT NOT NULL,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  invited_at      TIMESTAMPTZ DEFAULT NOW(),
  bot_active      BOOLEAN DEFAULT FALSE
);
```

- [ ] **Step 4: Create `apps/api/src/migrate.js`**

```js
const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations/001_channels.sql'),
    'utf8'
  );
  await pool.query(sql);
  console.log('Migration complete');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Add migrate script to `apps/api/package.json`**

Add `"migrate": "node --env-file-if-exists=.env src/migrate.js"` to the `scripts` block. The file should become:

```json
{
  "name": "@maple/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "node --env-file-if-exists=.env src/index.js",
    "dev": "node --watch --env-file-if-exists=.env src/index.js",
    "migrate": "node --env-file-if-exists=.env src/migrate.js"
  },
  "dependencies": {
    "@maple/lastfm": "workspace:*",
    "@maple/shared": "workspace:*",
    "express": "^4.19.2"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add .env.example apps/api/migrations/ apps/api/src/migrate.js apps/api/package.json
git commit -m "feat: add channels table migration and new env vars"
```

---

## Task 2: API — install packages, pg client, CORS, and bot routes

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/db.js`
- Create: `apps/api/src/routes/bot.js`
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Add `pg` and `cors` to API dependencies**

In `apps/api/package.json`, update the `dependencies` block:

```json
"dependencies": {
  "@maple/lastfm": "workspace:*",
  "@maple/shared": "workspace:*",
  "cors": "^2.8.5",
  "express": "^4.19.2",
  "pg": "^8.13.3"
}
```

- [ ] **Step 2: Install from repo root**

```bash
pnpm install
```

Expected: lockfile updates, `pg` and `cors` appear under `apps/api/node_modules`.

- [ ] **Step 3: Create `apps/api/src/db.js`**

```js
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

module.exports = pool;
```

- [ ] **Step 4: Run the migration**

Make sure your local Postgres is running (see `test-docker/` instructions in CLAUDE.md), then:

```bash
cd apps/api && pnpm migrate
```

Expected output: `Migration complete`

- [ ] **Step 5: Create `apps/api/src/routes/bot.js`**

```js
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/auth/bot/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TWITCH_BOT_CALLBACK_URI,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error('Token exchange failed:', text);
    return res.status(502).send('Token exchange failed');
  }

  const { access_token, refresh_token } = await tokenRes.json();

  // Fetch the streamer's Twitch user info
  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID,
    },
  });

  if (!userRes.ok) {
    console.error('Helix users fetch failed:', userRes.status);
    return res.status(502).send('Failed to fetch Twitch user');
  }

  const { data } = await userRes.json();
  const user = data[0];
  if (!user) return res.status(502).send('No user returned from Twitch');

  // Upsert channel row
  await pool.query(
    `INSERT INTO channels (twitch_user_id, twitch_login, access_token, refresh_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (twitch_user_id) DO UPDATE
       SET access_token  = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           twitch_login  = EXCLUDED.twitch_login,
           bot_active    = FALSE`,
    [user.id, user.login, access_token, refresh_token]
  );

  // Redirect browser back to frontend
  res.redirect(`${process.env.FRONTEND_URL}/dashboard/bot?invited=true`);
});

router.get('/bot/status', async (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ error: 'Missing channel param' });

  const result = await pool.query(
    'SELECT bot_active FROM channels WHERE twitch_login = $1',
    [channel]
  );

  if (result.rows.length === 0) {
    return res.json({ invited: false, active: false });
  }

  res.json({ invited: true, active: result.rows[0].bot_active });
});

module.exports = router;
```

- [ ] **Step 6: Update `apps/api/src/index.js`** to add CORS and mount the bot router

```js
const express = require('express');
const cors = require('cors');
const { getNowPlaying } = require('@maple/lastfm');
const botRouter = require('./routes/bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL }));

app.get('/nowplaying', async (req, res) => {
  const { user } = req.query;

  if (!user) {
    return res.status(400).type('text/plain').send('Error: Missing required query parameter: user');
  }

  try {
    const result = await getNowPlaying(user);
    res.type('text/plain').send(result);
  } catch (err) {
    res.status(err.status || 502).type('text/plain').send(`Error: ${err.message}`);
  }
});

app.use(botRouter);

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
```

- [ ] **Step 7: Smoke test the API**

```bash
cd apps/api && pnpm dev
```

In another terminal:
```bash
curl http://localhost:3000/bot/status?channel=testuser
```

Expected: `{"invited":false,"active":false}`

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/db.js apps/api/src/routes/bot.js apps/api/src/index.js apps/api/package.json
git commit -m "feat: add bot OAuth callback and status endpoints to API"
```

---

## Task 3: Bot — update packages and pg client

**Files:**
- Modify: `apps/bot/package.json`
- Create: `apps/bot/src/db.js`

- [ ] **Step 1: Update `apps/bot/package.json`**

Remove `tmi.js`, add `pg` and `ws`, add `test` script:

```json
{
  "name": "@maple/bot",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "node --env-file-if-exists=.env src/index.js",
    "dev": "node --watch --env-file-if-exists=.env src/index.js",
    "test": "node --test test/**/*.test.js"
  },
  "dependencies": {
    "@maple/shared": "workspace:*",
    "pg": "^8.13.3",
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 2: Install from repo root**

```bash
pnpm install
```

Expected: `tmi.js` removed, `pg` and `ws` installed under bot.

- [ ] **Step 3: Create `apps/bot/src/db.js`**

```js
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

module.exports = pool;
```

- [ ] **Step 4: Commit**

```bash
git add apps/bot/package.json apps/bot/src/db.js
git commit -m "feat: update bot deps (tmi.js → pg + ws)"
```

---

## Task 4: Bot — command handlers with TDD

**Files:**
- Create: `apps/bot/test/commands.test.js`
- Create: `apps/bot/src/commands.js`

- [ ] **Step 1: Create `apps/bot/test/commands.test.js`** (write the failing tests first)

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleCommand } = require('../src/commands');

test('!ping returns pong!', () => {
  assert.equal(handleCommand('!ping'), 'pong!');
});

test('unknown command returns null', () => {
  assert.equal(handleCommand('hello world'), null);
});

test('handles extra whitespace around !ping', () => {
  assert.equal(handleCommand('  !ping  '), 'pong!');
});

test('empty message returns null', () => {
  assert.equal(handleCommand(''), null);
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
cd apps/bot && pnpm test
```

Expected: `Error: Cannot find module '../src/commands'` — good, the module doesn't exist yet.

- [ ] **Step 3: Create `apps/bot/src/commands.js`**

```js
function handleCommand(message) {
  const text = message.trim();
  if (text === '!ping') return 'pong!';
  return null;
}

module.exports = { handleCommand };
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd apps/bot && pnpm test
```

Expected:
```
✔ !ping returns pong!
✔ unknown command returns null
✔ handles extra whitespace around !ping
✔ empty message returns null
```

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/commands.js apps/bot/test/commands.test.js
git commit -m "feat: add bot command handlers with unit tests"
```

---

## Task 5: Bot — Twitch API helpers

**Files:**
- Create: `apps/bot/src/twitch.js`

- [ ] **Step 1: Create `apps/bot/src/twitch.js`**

```js
let appAccessToken = null;
let tokenExpiry = 0;

async function getAppAccessToken() {
  if (appAccessToken && Date.now() < tokenExpiry) return appAccessToken;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get app access token: ${res.status} ${text}`);
  }

  const data = await res.json();
  appAccessToken = data.access_token;
  // Refresh 60 seconds before actual expiry
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return appAccessToken;
}

async function sendMessage(broadcasterId, message) {
  const token = await getAppAccessToken();

  const res = await fetch('https://api.twitch.tv/helix/chat/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id: process.env.BOT_USER_ID,
      message,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send message: ${res.status} ${text}`);
  }
}

module.exports = { getAppAccessToken, sendMessage };
```

- [ ] **Step 2: Commit**

```bash
git add apps/bot/src/twitch.js
git commit -m "feat: add Twitch Helix helpers (app token + sendMessage)"
```

---

## Task 6: Bot — EventSub WebSocket manager

**Files:**
- Create: `apps/bot/src/eventsub.js`

- [ ] **Step 1: Create `apps/bot/src/eventsub.js`**

```js
const WebSocket = require('ws');
const { getAppAccessToken } = require('./twitch');

class EventSubManager {
  constructor(onMessage) {
    // onMessage(broadcasterId, broadcasterLogin, chatterLogin, messageText)
    this.onMessage = onMessage;
    this.sessionId = null;
    this.ws = null;
    this.subscribedChannels = new Set();
    this._onReconnect = null;
  }

  onReconnect(fn) {
    this._onReconnect = fn;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

      this.ws.once('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.metadata.message_type === 'session_welcome') {
          this.sessionId = msg.payload.session.id;
          this.ws.on('message', (d) => this._handleMessage(d));
          resolve();
        } else {
          reject(new Error(`Unexpected first message type: ${msg.metadata.message_type}`));
        }
      });

      this.ws.on('error', reject);

      this.ws.on('close', () => this._handleClose());
    });
  }

  async _handleClose() {
    this.sessionId = null;
    this.subscribedChannels.clear();
    console.log('EventSub WebSocket closed — reconnecting in 5s...');
    await new Promise((r) => setTimeout(r, 5000));
    try {
      await this.connect();
      if (this._onReconnect) await this._onReconnect();
    } catch (err) {
      console.error('Reconnection failed:', err.message);
    }
  }

  _handleMessage(data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    if (
      msg.metadata.message_type === 'notification' &&
      msg.metadata.subscription_type === 'channel.chat.message'
    ) {
      const event = msg.payload.event;
      this.onMessage(
        event.broadcaster_user_id,
        event.broadcaster_user_login,
        event.chatter_user_login,
        event.message.text
      );
    }
  }

  async subscribeToChannel(broadcasterId) {
    if (this.subscribedChannels.has(broadcasterId)) return;

    const token = await getAppAccessToken();

    const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'channel.chat.message',
        version: '1',
        condition: {
          broadcaster_user_id: broadcasterId,
          user_id: process.env.BOT_USER_ID,
        },
        transport: {
          method: 'websocket',
          session_id: this.sessionId,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`EventSub subscription failed: ${res.status} ${text}`);
    }

    this.subscribedChannels.add(broadcasterId);
  }
}

module.exports = EventSubManager;
```

- [ ] **Step 2: Commit**

```bash
git add apps/bot/src/eventsub.js
git commit -m "feat: add EventSub WebSocket manager"
```

---

## Task 7: Bot — rewrite main entry point

**Files:**
- Modify: `apps/bot/src/index.js`

- [ ] **Step 1: Rewrite `apps/bot/src/index.js`**

```js
const pool = require('./db');
const { sendMessage } = require('./twitch');
const { handleCommand } = require('./commands');
const EventSubManager = require('./eventsub');

const manager = new EventSubManager(
  async (broadcasterId, broadcasterLogin, chatterLogin, messageText) => {
    const reply = handleCommand(messageText);
    if (!reply) return;
    try {
      await sendMessage(broadcasterId, reply);
    } catch (err) {
      console.error(`Failed to send message to #${broadcasterLogin}:`, err.message);
    }
  }
);

// Subscribe to ALL channels in the DB (used on startup and after reconnect)
async function subscribeAll() {
  const { rows } = await pool.query(
    'SELECT twitch_user_id, twitch_login FROM channels'
  );
  for (const row of rows) {
    try {
      await manager.subscribeToChannel(row.twitch_user_id);
      console.log(`Subscribed to #${row.twitch_login}`);
    } catch (err) {
      console.error(`Failed to subscribe to #${row.twitch_login}:`, err.message);
    }
  }
}

// Poll for new channels (bot_active = false) and activate them
async function pollNewChannels() {
  const { rows } = await pool.query(
    'SELECT twitch_user_id, twitch_login FROM channels WHERE bot_active = false'
  );
  for (const row of rows) {
    try {
      await manager.subscribeToChannel(row.twitch_user_id);
      await pool.query(
        'UPDATE channels SET bot_active = true WHERE twitch_user_id = $1',
        [row.twitch_user_id]
      );
      console.log(`Bot joined #${row.twitch_login}`);
    } catch (err) {
      console.error(`Failed to join #${row.twitch_login}:`, err.message);
    }
  }
}

manager.onReconnect(subscribeAll);

async function main() {
  await manager.connect();
  console.log('EventSub WebSocket connected');

  await subscribeAll();
  setInterval(pollNewChannels, 30_000);

  console.log('MapleBot ready');
}

main().catch((err) => {
  console.error('MapleBot failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke test the bot**

```bash
cd apps/bot && pnpm dev
```

Expected:
```
EventSub WebSocket connected
MapleBot ready
```

(No channels in DB yet, so no subscriptions. That's fine.)

- [ ] **Step 3: Commit**

```bash
git add apps/bot/src/index.js
git commit -m "feat: rewrite bot with Helix API + EventSub (drops tmi.js)"
```

---

## Task 8: Frontend — bot invite flow

**Files:**
- Modify: `apps/frontend/src/lib/twitchAuth.ts`
- Modify: `apps/frontend/src/pages/Bot.tsx`

- [ ] **Step 1: Add `buildBotAuthUrl` to `apps/frontend/src/lib/twitchAuth.ts`**

Add the following export after the existing `buildAuthUrl` function (after line 49):

```ts
export function buildBotAuthUrl(): string {
  if (!CLIENT_ID) throw new Error('VITE_TWITCH_CLIENT_ID is not set');
  const apiUrl = import.meta.env.VITE_API_URL as string;
  if (!apiUrl) throw new Error('VITE_API_URL is not set');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${apiUrl}/auth/bot/callback`,
    response_type: 'code',
    scope: 'channel:bot',
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}
```

- [ ] **Step 2: Rewrite the connection card in `apps/frontend/src/pages/Bot.tsx`**

At the top of the file, change the import line from:
```ts
import { useState, type ReactNode } from 'react';
```
to:
```ts
import { useState, useEffect, type ReactNode } from 'react';
```

Add the `buildBotAuthUrl` import alongside the existing twitchAuth import:
```ts
import type { TwitchUser } from '../lib/twitchAuth';
import { buildBotAuthUrl } from '../lib/twitchAuth';
```

Add new state and effects inside the `Bot` component, after the existing state declarations (after line 126):

```ts
const [botStatus, setBotStatus] = useState<{ invited: boolean; active: boolean } | null>(null);
const [statusLoading, setStatusLoading] = useState(true);
const apiUrl = import.meta.env.VITE_API_URL as string;

// Initial status check — or pick up ?invited=true from API redirect
useEffect(() => {
  if (!twitchUser) { setStatusLoading(false); return; }

  const params = new URLSearchParams(window.location.search);
  if (params.get('invited') === 'true') {
    setBotStatus({ invited: true, active: false });
    setStatusLoading(false);
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }

  fetch(`${apiUrl}/bot/status?channel=${twitchUser.login}`)
    .then(r => r.json())
    .then(data => { setBotStatus(data); setStatusLoading(false); })
    .catch(() => setStatusLoading(false));
}, [twitchUser?.login]);

// Poll every 10s while invite is pending
useEffect(() => {
  if (!twitchUser || !botStatus?.invited || botStatus.active) return;
  const interval = setInterval(() => {
    fetch(`${apiUrl}/bot/status?channel=${twitchUser.login}`)
      .then(r => r.json())
      .then(setBotStatus)
      .catch(() => {});
  }, 10_000);
  return () => clearInterval(interval);
}, [twitchUser?.login, botStatus?.invited, botStatus?.active]);
```

Replace the entire inner content of the connection card's `<div style={{ marginTop: 12 }}>` block (lines 244–270 in the original, starting from `<div style={{ display: 'flex', alignItems: 'center', gap: 10` and ending before the closing `</div>` of `marginTop: 12`):

```tsx
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--bg-1)',
    border: '1px solid var(--border-1)',
  }}
>
  <Icon name="twitch" size={18} style={{ color: 'var(--ink-1)' }} />
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>maple_bot</div>
    <div
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: botStatus?.active ? '#22C58B' : 'var(--ink-3)',
      }}
    >
      {statusLoading
        ? 'Checking...'
        : !twitchUser
        ? 'Sign in to invite the bot'
        : !botStatus?.invited
        ? 'Not in your channel'
        : !botStatus.active
        ? 'Joining your channel...'
        : `Connected · twitch.tv/${twitchUser.login}`}
    </div>
  </div>
  {!statusLoading && twitchUser && (
    !botStatus?.invited
      ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => { window.location.href = buildBotAuthUrl(); }}
        >
          Invite Bot
        </Button>
      )
      : botStatus.active
      ? (
        <Button
          variant="ghost"
          size="sm"
          icon={reconnecting ? 'refresh' : 'refresh'}
          disabled={reconnecting}
          onClick={handleReconnect}
        >
          {reconnecting ? 'Reconnecting…' : 'Reconnect'}
        </Button>
      )
      : null
  )}
</div>
```

- [ ] **Step 3: Manual test checklist**

Start the API and frontend:
```bash
# Terminal 1
cd apps/api && pnpm dev

# Terminal 2
cd apps/frontend && pnpm dev
```

Walk through:
1. Open http://localhost:5173, sign in with Twitch
2. Navigate to the Bot tab in the dashboard
3. The connection card should show "Not in your channel" and an "Invite Bot" button
4. Click "Invite Bot" — browser should redirect to Twitch's OAuth page asking for `channel:bot` permission
5. Authorize — Twitch redirects to `http://localhost:3000/auth/bot/callback?code=...`
6. The API exchanges the code and redirects you back to `http://localhost:5173/dashboard/bot?invited=true`
7. The connection card should immediately show "Joining your channel..."
8. In the DB, verify the row was inserted: `SELECT * FROM channels;`
9. Start the bot (`cd apps/bot && pnpm dev`) — it should log `Bot joined #<yourlogin>` within 30s
10. The card should poll and switch to "Connected · twitch.tv/\<yourlogin\>"
11. In Twitch chat, type `!ping` — `maple_bot` should reply `pong!` with the bot badge

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/twitchAuth.ts apps/frontend/src/pages/Bot.tsx
git commit -m "feat: add bot invite flow to frontend (three-state connection card)"
```

---

## Self-review notes (spec coverage)

| Spec requirement | Covered by |
|---|---|
| `channels` table schema | Task 1 |
| New env vars | Task 1 |
| `/auth/bot/callback` endpoint | Task 2 |
| `/bot/status` endpoint | Task 2 |
| Bot drops tmi.js | Task 3 |
| App access token (bot badge) | Task 5 |
| EventSub WebSocket | Task 6 |
| 30s polling loop | Task 7 |
| `bot_active` flipped after join | Task 7 |
| Re-subscribe all channels on restart | Task 7 |
| Frontend: three-state connection card | Task 8 |
| Frontend: `?invited=true` immediate pending | Task 8 |
| Frontend: 10s status poll | Task 8 |
| Bot leaves channels: out of scope | ✓ (none) |
| Token refresh: out of scope | ✓ (none) |
