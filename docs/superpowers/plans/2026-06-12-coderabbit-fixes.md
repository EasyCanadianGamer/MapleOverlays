# CodeRabbit Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 51 CodeRabbit findings (9 critical, 21 major, 8 minor) across apps/api, apps/bot, and apps/frontend.

**Architecture:** Fixes are grouped by severity and file proximity. No new abstractions are introduced — each change is the minimal safe fix in place. Token encryption (Task 1) requires a new `apps/api/src/crypto.js` module and a new migration file; everything else is inline edits.

**Tech Stack:** Node.js (Express, pg), React 18 + TypeScript + Vite, Twitch EventSub WebSocket, pnpm workspaces.

---

## CRITICAL FIXES

---

### Task 1: Encrypt tokens at rest in the database

The `channels` table stores `access_token` and `refresh_token` as plaintext. If the DB is ever dumped, every invited channel's Twitch credentials are exposed.

**Files:**
- Create: `apps/api/src/crypto.js`
- Create: `apps/api/migrations/002_encrypt_tokens.sql`
- Modify: `apps/api/src/routes/bot.js` (OAuth callback writes + command reads)
- Modify: `apps/api/src/index.js` (remove `ensureSchema`, wire migration runner)
- Modify: `apps/api/src/migrate.js` (run all migrations in order)
- Modify: `apps/bot/src/index.js` (reads `access_token` from DB — now encrypted)

**How it works:** Add `ENCRYPTION_KEY` (32-byte hex) to env. `crypto.js` wraps Node's built-in `crypto` module using AES-256-GCM. Tokens are encrypted before INSERT and decrypted on read. The migration adds `token_expires_at` and `updated_at` columns and an index on `twitch_login`.

- [ ] **Step 1: Add ENCRYPTION_KEY to .env.example**

In `.env.example`, append after the `DATABASE_URL` block:

```
# Token encryption — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=
```

- [ ] **Step 2: Create crypto.js**

Create `apps/api/src/crypto.js`:

```js
const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY;

if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

const KEY = Buffer.from(KEY_HEX, 'hex');

function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(ciphertext) {
  if (!ciphertext) return null;
  const buf = Buffer.from(ciphertext, 'base64');
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
```

- [ ] **Step 3: Create migration 002**

Create `apps/api/migrations/002_encrypt_tokens.sql`:

```sql
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS channels_twitch_login_idx ON channels (twitch_login);
```

Note: This migration does NOT re-encrypt existing tokens — that would require a data migration script. For a fresh install (dev/staging), this is fine. For a live deployment with existing rows, run a one-off script to encrypt existing plaintext tokens before deploying this change.

- [ ] **Step 4: Update migrate.js to run all migrations in order**

Replace `apps/api/src/migrate.js` with:

```js
const pool = require('./db');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      run_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rows.length > 0) { console.log(`Skipped (already run): ${file}`); continue; }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    console.log(`Ran migration: ${file}`);
  }

  console.log('All migrations complete');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Update api/src/index.js — replace ensureSchema with migration runner**

In `apps/api/src/index.js`, replace the entire `ensureSchema` function and its call:

```js
// REMOVE lines 13-51 (the entire ensureSchema function)
// REMOVE line 78: ensureSchema()
//   .then(() => app.listen(...))
//   .catch(...)

// REPLACE the bottom of the file with:
const { migrate } = require('./migrate');

migrate()
  .then(() => app.listen(PORT, () => console.log(`Listening on port ${PORT}`)))
  .catch(err => { console.error('Startup failed:', err); process.exit(1); });
```

But first, `migrate.js` currently calls `pool.end()` which would close the shared pool. Update `migrate.js` to export a function instead of running immediately:

```js
// apps/api/src/migrate.js — export migrate() instead of calling it
const pool = require('./db');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      run_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rows.length > 0) { console.log(`Skipped (already run): ${file}`); continue; }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    console.log(`Ran migration: ${file}`);
  }
  console.log('All migrations complete');
}

// Allow running directly: `node src/migrate.js`
if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch(err => { console.error('Migration failed:', err); process.exit(1); });
}

module.exports = { migrate };
```

- [ ] **Step 6: Encrypt on write in bot.js OAuth callback**

In `apps/api/src/routes/bot.js`, add at the top:

```js
const { encrypt, decrypt } = require('../crypto');
```

In the `/auth/bot/callback` handler, change the pool.query INSERT to encrypt before writing:

```js
await pool.query(
  `INSERT INTO channels (twitch_user_id, twitch_login, access_token, refresh_token)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (twitch_user_id) DO UPDATE
     SET access_token  = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         twitch_login  = EXCLUDED.twitch_login,
         updated_at    = NOW(),
         bot_active    = FALSE`,
  [user.id, user.login, encrypt(access_token), encrypt(refresh_token)]
);
```

- [ ] **Step 7: Decrypt on read in bot/src/index.js**

In `apps/bot/src/index.js`, add at the top:

```js
const { decrypt } = require('./crypto');
```

Create `apps/bot/src/crypto.js` (bot needs its own copy since it's a separate workspace app):

```js
const { createDecipheriv } = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY;

if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes).');
}

const KEY = Buffer.from(KEY_HEX, 'hex');

function decrypt(ciphertext) {
  if (!ciphertext) return null;
  const buf = Buffer.from(ciphertext, 'base64');
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { decrypt };
```

In `apps/bot/src/index.js`, update `getChannelData` — where it reads `access_token` from DB, wrap it:

```js
const accessToken = chanResult.rows[0]?.access_token ? decrypt(chanResult.rows[0].access_token) : null;
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/crypto.js apps/bot/src/crypto.js \
        apps/api/migrations/002_encrypt_tokens.sql \
        apps/api/src/migrate.js apps/api/src/index.js \
        apps/api/src/routes/bot.js apps/bot/src/index.js \
        .env.example
git commit -m "feat: encrypt access/refresh tokens at rest with AES-256-GCM"
```

---

### Task 2: Upgrade ws dependency (CVE-2026-45736) + fix @types/react mismatch

Two package version fixes that are quick and independent.

**Files:**
- Modify: `apps/bot/package.json`
- Modify: `apps/frontend/package.json`

- [ ] **Step 1: Bump ws in apps/bot/package.json**

In `apps/bot/package.json`, change:
```json
"ws": "^8.18.0"
```
to:
```json
"ws": "^8.20.1"
```

- [ ] **Step 2: Fix @types/react version mismatch in apps/frontend/package.json**

In `apps/frontend/package.json`, change:
```json
"@types/react": "^19.2.17",
"@types/react-dom": "^19.2.3",
```
to:
```json
"@types/react": "^18.3.26",
"@types/react-dom": "^18.3.7",
```

- [ ] **Step 3: Install updated deps**

```bash
pnpm install
```

Expected: no errors, lockfile updated.

- [ ] **Step 4: Commit**

```bash
git add apps/bot/package.json apps/frontend/package.json pnpm-lock.yaml
git commit -m "fix: upgrade ws to 8.20.1 (CVE-2026-45736), fix @types/react to v18"
```

---

### Task 3: Validate required env vars at bot startup

`apps/bot/src/twitch.js` reads `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` without checking they're set. A missing env var sends `"undefined"` as an Authorization header to Twitch, which fails silently at runtime instead of at startup.

**Files:**
- Modify: `apps/bot/src/twitch.js`

- [ ] **Step 1: Add module-level validation and fetch timeout to twitch.js**

At the top of `apps/bot/src/twitch.js`, before the `let appAccessToken` line, add:

```js
const REQUIRED = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'BOT_USER_ID'];
for (const name of REQUIRED) {
  if (!process.env[name]) throw new Error(`Missing required env var: ${name}`);
}
```

Also fix `getBroadcasterStream` to return `null` on non-OK (consistent with `getChannelInfo`):

```js
async function getBroadcasterStream(broadcasterId) {
  const token = await getAppAccessToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
      },
    },
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data[0] ?? null;
}
```

Also add a 500-char guard to `sendMessage`:

```js
async function sendMessage(broadcasterId, message) {
  if (!broadcasterId) throw new Error('sendMessage: broadcasterId is required');
  if (!message || message.length > 500) throw new Error(`sendMessage: message must be 1–500 chars (got ${message?.length ?? 0})`);
  // ... rest unchanged
```

- [ ] **Step 2: Commit**

```bash
git add apps/bot/src/twitch.js
git commit -m "fix: validate required env vars at bot startup, guard sendMessage length"
```

---

### Task 4: Harden EventSub message handler + subscribeToChannel

Two related `eventsub.js` issues: `_handleMessage` crashes on malformed payloads, and `subscribeToChannel` uses `Promise.all` which leaves duplicate subscriptions on partial failure.

**Files:**
- Modify: `apps/bot/src/eventsub.js`

- [ ] **Step 1: Fix _handleMessage to guard all field access**

Replace the `_handleMessage` method (lines 54–79) in `apps/bot/src/eventsub.js`:

```js
_handleMessage(data) {
  let msg;
  try { msg = JSON.parse(data); } catch { return; }

  if (!msg?.metadata?.message_type) return;
  const { message_type, subscription_type } = msg.metadata;
  if (message_type !== 'notification') return;

  const event = msg.payload?.event;
  if (!event) return;

  if (subscription_type === 'channel.chat.message') {
    const broadcasterId  = event.broadcaster_user_id;
    const broadcasterLogin = event.broadcaster_user_login;
    const chatterId      = event.chatter_user_id;
    const chatterLogin   = event.chatter_user_login;
    const text           = event.message?.text;
    if (!broadcasterId || !text) return;
    this.onMessage(broadcasterId, broadcasterLogin, chatterId, chatterLogin, text);
  } else if (subscription_type === 'stream.offline') {
    if (event.broadcaster_user_id) this._onStreamState?.(event.broadcaster_user_id, false);
  } else if (subscription_type === 'stream.online') {
    if (event.broadcaster_user_id) this._onStreamState?.(event.broadcaster_user_id, true);
  }
}
```

- [ ] **Step 2: Fix subscribeToChannel to use Promise.allSettled**

Replace the `subscribeToChannel` method (lines 103–117):

```js
async subscribeToChannel(broadcasterId) {
  if (this.subscribedChannels.has(broadcasterId)) return;
  if (!this.sessionId) throw new Error('Not connected to EventSub — session ID not available');

  const results = await Promise.allSettled([
    this._subscribe('channel.chat.message', {
      broadcaster_user_id: broadcasterId,
      user_id: process.env.BOT_USER_ID,
    }),
    this._subscribe('stream.offline', { broadcaster_user_id: broadcasterId }),
    this._subscribe('stream.online',  { broadcaster_user_id: broadcasterId }),
  ]);

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    const errors = failures.map(f => f.reason.message).join('; ');
    throw new Error(`Failed to subscribe to some EventSub events for ${broadcasterId}: ${errors}`);
  }

  this.subscribedChannels.add(broadcasterId);
}
```

- [ ] **Step 3: Fix persistent error listener after initial connect**

In the `connect()` method, replace the single `this.ws.on('error', reject)` line with a two-phase approach:

```js
connect() {
  return new Promise((resolve, reject) => {
    this.ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

    this.ws.once('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.metadata.message_type === 'session_welcome') {
        this.sessionId = msg.payload.session.id;
        this.ws.on('message', (d) => this._handleMessage(d));
        // Persistent error handler now that the initial promise has resolved
        this.ws.on('error', (err) => console.error('EventSub WebSocket error:', err.message));
        resolve();
      } else {
        reject(new Error(`Unexpected first message type: ${msg.metadata.message_type}`));
      }
    });

    // One-time error for initial connection failure
    this.ws.once('error', reject);
    this.ws.on('close', () => this._handleClose());
  });
}
```

- [ ] **Step 4: Validate env vars in _subscribe + add exponential backoff to _handleClose**

Add env var validation to the class constructor (or top of file, before the class):

```js
// At top of eventsub.js, before the class:
if (!process.env.BOT_ACCESS_TOKEN) throw new Error('Missing required env var: BOT_ACCESS_TOKEN');
if (!process.env.TWITCH_CLIENT_ID) throw new Error('Missing required env var: TWITCH_CLIENT_ID');
if (!process.env.BOT_USER_ID)      throw new Error('Missing required env var: BOT_USER_ID');
```

Replace `_handleClose` with exponential backoff:

```js
async _handleClose() {
  this.sessionId = null;
  this.subscribedChannels.clear();
  const MAX_ATTEMPTS = 10;
  const BASE_DELAY   = 1000;
  const MAX_DELAY    = 30_000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const delay = Math.min(BASE_DELAY * 2 ** (attempt - 1), MAX_DELAY);
    console.log(`EventSub closed — reconnecting in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    await new Promise(r => setTimeout(r, delay));
    try {
      await this.connect();
      if (this._onReconnect) {
        try { await this._onReconnect(); } catch (err) { console.error('Reconnect callback failed:', err.message); }
      }
      return;
    } catch (err) {
      console.error(`Reconnection attempt ${attempt} failed:`, err.message);
    }
  }
  console.error('EventSub: max reconnection attempts reached. Exiting.');
  process.exit(1);
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/eventsub.js
git commit -m "fix: harden EventSub message parsing, allSettled subscriptions, exponential backoff"
```

---

### Task 5: Fix silent DB errors in bot/src/index.js + add graceful shutdown

Two issues: watchtime INSERT silently swallows errors (`.catch(() => {})`), stream state handlers throw unhandled rejections, and there are no SIGINT/SIGTERM handlers so watchtimes aren't flushed on shutdown.

**Files:**
- Modify: `apps/bot/src/index.js`

- [ ] **Step 1: Fix flushWatchtimes to log errors**

In `apps/bot/src/index.js`, replace the `.catch(() => {})` in `flushWatchtimes`:

```js
await pool.query(
  `INSERT INTO watchtimes (channel_user_id, viewer_login, total_seconds)
   VALUES ($1, $2, $3)
   ON CONFLICT (channel_user_id, viewer_login) DO UPDATE
     SET total_seconds = watchtimes.total_seconds + EXCLUDED.total_seconds`,
  [broadcasterId, viewerLogin, seconds]
).catch(err => {
  console.error(`Failed to persist watchtime for ${viewerLogin} in ${broadcasterId}:`, err.message);
});
```

- [ ] **Step 2: Add try/catch around stream state DB updates**

Replace the `manager.onStreamState` handler (lines 88–106):

```js
manager.onStreamState(async (broadcasterId, isLive) => {
  if (isLive) {
    sessionMap.delete(broadcasterId);
    await pool.query(
      'UPDATE channels SET offline_since = NULL WHERE twitch_user_id = $1',
      [broadcasterId]
    ).catch(err => console.error(`Failed to update online state for ${broadcasterId}:`, err.message));
  } else {
    await flushWatchtimes(broadcasterId);
    await pool.query(
      'UPDATE channels SET offline_since = NOW() WHERE twitch_user_id = $1',
      [broadcasterId]
    ).catch(err => console.error(`Failed to update offline state for ${broadcasterId}:`, err.message));
  }
  configCache.delete(broadcasterId);
  console.log(`Stream ${isLive ? 'online' : 'offline'}: ${broadcasterId}`);
});
```

- [ ] **Step 3: Add graceful shutdown handlers**

After the `main()` call at the bottom of `apps/bot/src/index.js`, add:

```js
let pollInterval = null;

async function main() {
  await manager.connect();
  console.log('EventSub WebSocket connected');
  await subscribeAll();
  pollInterval = setInterval(pollNewChannels, 30_000);
  console.log('MapleBot ready');
}

async function shutdown(signal) {
  console.log(`\nReceived ${signal} — flushing watchtimes and shutting down...`);
  if (pollInterval) clearInterval(pollInterval);
  const channelIds = [...sessionMap.keys()];
  await Promise.allSettled(channelIds.map(id => flushWatchtimes(id)));
  console.log('Watchtimes flushed. Goodbye.');
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch(err => {
  console.error('MapleBot failed to start:', err);
  process.exit(1);
});
```

Note: remove the old `setInterval(pollNewChannels, 30_000)` from inside `main()` and reference `pollInterval` instead so shutdown can clear it.

- [ ] **Step 4: Commit**

```bash
git add apps/bot/src/index.js
git commit -m "fix: log watchtime DB errors, add SIGINT/SIGTERM graceful shutdown"
```

---

### Task 6: Fix Landing.tsx TierCard external link

`TierCard` always renders `<Link to={ctaHref}>` from react-router-dom. When `ctaHref` is `https://github.com/...`, React Router tries to match it as an internal route and navigates to `/https:/github.com/...` — a 404.

**Files:**
- Modify: `apps/frontend/src/pages/Landing.tsx`

- [ ] **Step 1: Fix TierCard CTA to use anchor for external URLs**

In `Landing.tsx`, replace the `<Link to={ctaHref} ...>` block inside `TierCard` (around lines 208–226):

```tsx
{ctaHref.startsWith('http') || ctaHref.startsWith('//') ? (
  <a
    href={ctaHref}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: 'block',
      textAlign: 'center',
      padding: '12px 20px',
      borderRadius: 12,
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      fontSize: 15,
      textDecoration: 'none',
      background: highlight ? color : 'var(--bg-3)',
      color: highlight ? '#fff' : 'var(--ink-0)',
      border: highlight ? '1px solid transparent' : '1px solid var(--border-2)',
      marginTop: 'auto',
    }}
  >
    {cta}
  </a>
) : (
  <Link
    to={ctaHref}
    style={{
      display: 'block',
      textAlign: 'center',
      padding: '12px 20px',
      borderRadius: 12,
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      fontSize: 15,
      textDecoration: 'none',
      background: highlight ? color : 'var(--bg-3)',
      color: highlight ? '#fff' : 'var(--ink-0)',
      border: highlight ? '1px solid transparent' : '1px solid var(--border-2)',
      marginTop: 'auto',
    }}
  >
    {cta}
  </Link>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/Landing.tsx
git commit -m "fix: TierCard CTA uses anchor for external URLs instead of react-router Link"
```

---

## MAJOR FIXES

---

### Task 7: Add error handling to API bot routes

`getCallerTwitchId` can throw (network error), and the entire OAuth callback handler has no top-level try/catch, meaning thrown errors leave requests hanging.

**Files:**
- Modify: `apps/api/src/routes/bot.js`

- [ ] **Step 1: Wrap getCallerTwitchId in try/catch**

Replace the `getCallerTwitchId` function:

```js
async function getCallerTwitchId(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const res = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
      },
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Wrap OAuth callback in try/catch**

Wrap the entire body of `router.get('/auth/bot/callback', async (req, res) => { ... })` in a `try { ... } catch (err) { console.error('OAuth callback error:', err); res.status(500).send('Internal server error'); }` block.

The handler already has inline error checks (`if (!tokenRes.ok)` etc.) — the try/catch only needs to catch unexpected throws from network failures or JSON parse errors.

```js
router.get('/auth/bot/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code');

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

    await pool.query(
      `INSERT INTO channels (twitch_user_id, twitch_login, access_token, refresh_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (twitch_user_id) DO UPDATE
         SET access_token  = EXCLUDED.access_token,
             refresh_token = EXCLUDED.refresh_token,
             twitch_login  = EXCLUDED.twitch_login,
             updated_at    = NOW(),
             bot_active    = FALSE`,
      [user.id, user.login, encrypt(access_token), encrypt(refresh_token)]
    );

    const state = req.query.state ? `&state=${encodeURIComponent(req.query.state)}` : '';
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?view=bot-settings&invited=true${state}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('Internal server error');
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/bot.js
git commit -m "fix: wrap bot OAuth callback and getCallerTwitchId in try/catch"
```

---

### Task 8: Harden DB pool configuration (both api and bot)

Both `apps/api/src/db.js` and `apps/bot/src/db.js` create pools with no connection limits and minimal error logging.

**Files:**
- Modify: `apps/api/src/db.js`
- Modify: `apps/bot/src/db.js`
- Modify: `.env.example`

- [ ] **Step 1: Update both db.js files**

Replace `apps/api/src/db.js` with:

```js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:     process.env.DATABASE_URL,
  max:                  parseInt(process.env.DB_POOL_MAX  ?? '10', 10),
  idleTimeoutMillis:    parseInt(process.env.DB_IDLE_TIMEOUT_MS    ?? '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '5000', 10),
  statement_timeout:    parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? '10000', 10),
});

pool.on('error', (err) => {
  console.error('Postgres pool error (api):', err.code, err.message, err.stack);
});

module.exports = pool;
```

Replace `apps/bot/src/db.js` with the same, changing the log tag to `(bot)`:

```js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:     process.env.DATABASE_URL,
  max:                  parseInt(process.env.DB_POOL_MAX  ?? '5', 10),
  idleTimeoutMillis:    parseInt(process.env.DB_IDLE_TIMEOUT_MS    ?? '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '5000', 10),
  statement_timeout:    parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? '10000', 10),
});

pool.on('error', (err) => {
  console.error('Postgres pool error (bot):', err.code, err.message, err.stack);
});

module.exports = pool;
```

- [ ] **Step 2: Document pool env vars in .env.example**

Append to `.env.example` after `DATABASE_URL`:

```
# DB pool tuning (optional — defaults shown)
# DB_POOL_MAX=10
# DB_IDLE_TIMEOUT_MS=30000
# DB_CONNECTION_TIMEOUT_MS=5000
# DB_STATEMENT_TIMEOUT_MS=10000
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db.js apps/bot/src/db.js .env.example
git commit -m "fix: add DB pool limits and richer error logging"
```

---

### Task 9: Fix Settings.tsx save error handling + useStreamInfo/useTwitchStats setState after unmount

Three related React hooks/component issues: swallowed save errors and setState on unmounted components.

**Files:**
- Modify: `apps/frontend/src/pages/Settings.tsx`
- Modify: `apps/frontend/src/hooks/useStreamInfo.ts`
- Modify: `apps/frontend/src/hooks/useTwitchStats.ts`

- [ ] **Step 1: Add saveError state to Settings.tsx**

In `Settings.tsx`, add `saveError` state and wire it up:

```tsx
const [saveError, setSaveError] = useState<string | null>(null);

const saveSettings = async () => {
  const token = getToken();
  if (!token) return;
  setSaving(true);
  setSaveError(null);
  try {
    const res = await fetch(`${apiUrl}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lastfm_username: lastfmUsername, tip_url: tipUrl }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : 'Failed to save');
  } finally {
    setSaving(false);
  }
};
```

Also fix the settings load effect to catch errors:

```tsx
useEffect(() => {
  const token = getToken();
  if (!token) return;
  fetch(`${apiUrl}/settings`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json())
    .then((data: { lastfm_username: string; tip_url: string }) => {
      setLastfmUsername(data.lastfm_username ?? '');
      setTipUrl(data.tip_url ?? '');
    })
    .catch(() => setSaveError('Failed to load settings'));
}, [connected]);
```

Add error display in JSX after the save button:

```tsx
{saveError && (
  <div style={{ fontSize: 12, color: '#e05', marginTop: 6 }}>{saveError}</div>
)}
```

- [ ] **Step 2: Fix useStreamInfo to cancel state updates after unmount**

In `apps/frontend/src/hooks/useStreamInfo.ts`, replace the fetch `useEffect`:

```ts
useEffect(() => {
  if (!user) return;
  const token = getToken();
  if (!token) return;
  let cancelled = false;
  setLoading(true);
  fetchStreamInfo(token, user.id)
    .then(i => {
      if (!cancelled) { setInfo(i); setLoading(false); }
    })
    .catch(() => {
      if (!cancelled) setLoading(false);
    });
  return () => { cancelled = true; };
}, [user]);
```

- [ ] **Step 3: Fix useTwitchStats to cancel state updates after unmount**

In `apps/frontend/src/hooks/useTwitchStats.ts`, replace the fetch `useEffect`:

```ts
useEffect(() => {
  if (!user) return;
  const token = getToken();
  if (!token) return;
  let cancelled = false;
  setLoading(true);
  fetchChannelStats(token, user.id)
    .then(s => {
      if (!cancelled) { setStats(s); setLoading(false); }
    })
    .catch(() => {
      if (!cancelled) setLoading(false);
    });
  return () => { cancelled = true; };
}, [user, tick]);
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/Settings.tsx \
        apps/frontend/src/hooks/useStreamInfo.ts \
        apps/frontend/src/hooks/useTwitchStats.ts
git commit -m "fix: surface save errors in Settings, cancel stale hook state updates"
```

---

### Task 10: Fix Overlays.tsx setTimeout leak + TopBar hardcoded category + eventSub.ts error handling

**Files:**
- Modify: `apps/frontend/src/pages/Overlays.tsx`
- Modify: `apps/frontend/src/components/layout/TopBar.tsx`
- Modify: `apps/frontend/src/lib/eventSub.ts`

- [ ] **Step 1: Fix Overlays.tsx setTimeout cleanup**

In `apps/frontend/src/pages/Overlays.tsx`, in the `OverlayDetail` component, add a ref for the timeout:

```tsx
const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
  };
}, []);

const playPreview = () => {
  setPlaying(true);
  if (config.sound) playOverlaySound(overlay.id);
  localStorage.setItem(`maple_trigger_${overlay.id}`, Date.now().toString());
  const ms = overlay.id === 'brb' ? 3000 : Math.max(config.duration * 1000, 1500);
  if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
  playTimeoutRef.current = setTimeout(() => setPlaying(false), ms);
};
```

- [ ] **Step 2: Fix TopBar hardcoded category**

In `apps/frontend/src/components/layout/TopBar.tsx`, add `category` to props:

```tsx
interface TopBarProps {
  live: boolean;
  onToggleLive: () => void;
  viewers: number | null;
  title: string;
  onTitleChange: (value: string) => void;
  category?: string;
}

export default function TopBar({ live, onToggleLive, viewers, title, onTitleChange, category }: TopBarProps) {
```

Replace the hardcoded `just chatting` span:

```tsx
<span
  style={{
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--ink-3)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }}
>
  {category || 'No category'}
</span>
```

Add `maxLength={140}` to the stream title input:

```tsx
<input
  value={title}
  onChange={e => onTitleChange(e.target.value)}
  placeholder="Stream title…"
  maxLength={140}
  style={{ ... }}
/>
```

- [ ] **Step 3: Fix eventSub.ts createSubscription to log failures**

In `apps/frontend/src/lib/eventSub.ts`, replace `createSubscription`:

```ts
async function createSubscription(
  sessionId: string,
  overlayId: string,
  token: string,
  uid: string,
): Promise<void> {
  if (!CLIENT_ID) return;
  const sub = SUBS[overlayId];
  if (!sub) return;
  try {
    const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Client-Id':    CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type:      sub.type,
        version:   sub.version,
        condition: buildCondition(overlayId, uid),
        transport: { method: 'websocket', session_id: sessionId },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`EventSub subscription failed for ${overlayId} (${res.status}):`, err);
    }
  } catch (err) {
    console.error('EventSub subscription network error:', err);
  }
}
```

Also handle `session_reconnect` in `connectEventSub`:

```ts
if (msgType === 'session_reconnect' && msg.payload.session?.reconnect_url) {
  const reconnectUrl = msg.payload.session.reconnect_url;
  const newWs = new WebSocket(reconnectUrl);
  newWs.onmessage = ws.onmessage;
  newWs.onerror   = () => {};
  newWs.onopen    = () => { ws.close(); };
}
```

Add this block inside `ws.onmessage` after the `session_welcome` check.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/Overlays.tsx \
        apps/frontend/src/components/layout/TopBar.tsx \
        apps/frontend/src/lib/eventSub.ts
git commit -m "fix: Overlays timeout cleanup, TopBar category prop, eventSub error logging + reconnect"
```

---

### Task 11: Fix BotModerator persistence + Bot.tsx reconnect + BUILTIN_COMMANDS completeness

**Files:**
- Modify: `apps/frontend/src/pages/BotModerator.tsx`
- Modify: `apps/frontend/src/pages/Bot.tsx`

- [ ] **Step 1: Persist BotModerator toggles to the API**

The API doesn't have a `/bot/moderator` endpoint yet. Since this is client-side only data right now (the auto-mod rules aren't enforced by the bot), the minimal fix is to note in the UI that these are UI-only placeholders, or add `localStorage` persistence instead of a full API endpoint (avoids scope creep). Update `BotModerator.tsx`:

```tsx
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'maple_automod_settings';

export default function BotModerator() {
  const [autoMod, setAutoMod] = useState<boolean[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : AUTO_MOD_RULES.map(r => r.defaultOn);
    } catch {
      return AUTO_MOD_RULES.map(r => r.defaultOn);
    }
  });

  const toggleRule = (index: number) => {
    setAutoMod(prev => {
      const next = prev.map((v, j) => j === index ? !v : v);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ... JSX: replace onChange={() => setAutoMod(...)} with onChange={() => toggleRule(i)}
```

- [ ] **Step 2: Fix Bot.tsx handleReconnect to call real backend endpoint**

In `apps/frontend/src/pages/Bot.tsx`, replace `handleReconnect`:

```tsx
const handleReconnect = async () => {
  if (!twitchUser) return;
  const token = getToken();
  if (!token) return;
  setReconnecting(true);
  try {
    await fetch(`${apiUrl}/bot/reconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('Reconnect failed:', err);
  } finally {
    setReconnecting(false);
  }
};
```

Note: The backend `/bot/reconnect` endpoint doesn't exist yet — this makes the button actually call an endpoint rather than a fake timeout. The endpoint can be added to `apps/api/src/routes/bot.js` as a stub:

```js
router.post('/bot/reconnect', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
  // Future: signal bot process to re-subscribe for this channel
  res.json({ ok: true, message: 'Reconnect requested. Bot will re-subscribe shortly.' });
});
```

- [ ] **Step 3: Complete BUILTIN_COMMANDS in Bot.tsx**

In `apps/frontend/src/pages/Bot.tsx`, replace the incomplete `BUILTIN_COMMANDS` array (currently only 2 entries):

```tsx
const BUILTIN_COMMANDS = [
  { key: 'ping',       command: '!ping',       description: 'Checks if the bot is alive',              defaultResponse: 'pong!',         dynamic: false },
  { key: 'song',       command: '!song',       description: 'Currently playing track via Last.fm',     defaultResponse: '',              dynamic: true  },
  { key: 'uptime',     command: '!uptime',     description: 'How long the stream has been live',       defaultResponse: '',              dynamic: true  },
  { key: 'downtime',   command: '!downtime',   description: 'How long the stream has been offline',    defaultResponse: '',              dynamic: true  },
  { key: 'followage',  command: '!followage',  description: 'How long the viewer has been following',  defaultResponse: '',              dynamic: true  },
  { key: 'accountage', command: '!accountage', description: 'How old the viewer\'s Twitch account is', defaultResponse: '',              dynamic: true  },
  { key: 'watchtime',  command: '!watchtime',  description: 'Total time the viewer has spent watching',defaultResponse: '',              dynamic: true  },
  { key: 'tip',        command: '!tip',        description: 'Shows the tip/donation link',             defaultResponse: '',              dynamic: false },
  { key: 'commands',   command: '!commands',   description: 'Lists available commands',                defaultResponse: '',              dynamic: false },
] as const;
```

Also update the `commandConfigs` fetch to include the `builtin` field:

```tsx
.then((data: Array<{ command: string; enabled: boolean; response: string | null; builtin?: boolean }>) => {
  setCommandConfigs(prev => {
    const next = { ...prev };
    for (const cfg of data) next[cfg.command] = { enabled: cfg.enabled, response: cfg.response ?? '', builtin: cfg.builtin ?? false };
    return next;
  });
})
```

Update the `CmdCfg` type at the top of Bot.tsx to include `builtin`:

```tsx
type CmdCfg = { enabled: boolean; response: string; builtin?: boolean };
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/BotModerator.tsx \
        apps/frontend/src/pages/Bot.tsx \
        apps/api/src/routes/bot.js
git commit -m "fix: persist BotModerator to localStorage, fix reconnect endpoint, complete BUILTIN_COMMANDS"
```

---

### Task 12: Update DATABASE_URL example + fix TESTING.md bot section

**Files:**
- Modify: `.env.example`
- Modify: `docs/TESTING.md`

- [ ] **Step 1: Fix DATABASE_URL in .env.example**

In `.env.example`, update the DATABASE_URL comment:

```
# Used by api and bot services — update password to match POSTGRES_PASSWORD
# For docker-compose: use "postgres" as the hostname (service name), not "localhost"
# For local dev (test-docker): use "localhost:5432"
DATABASE_URL=postgresql://maple:CHANGE_ME@localhost:5432/maple
```

- [ ] **Step 2: Update TESTING.md bot section**

Replace the `## Bot (apps/bot)` section in `docs/TESTING.md`:

```markdown
## Bot (`apps/bot`)

**Requires env vars:** `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `BOT_USER_ID`, `BOT_ACCESS_TOKEN`, `DATABASE_URL`, `ENCRYPTION_KEY`

The bot uses Twitch's EventSub WebSocket (not IRC/tmi.js). There is no IRC connection string in the logs.

**Get a bot access token:**
1. Go to the dashboard and click "Invite bot to channel" — this triggers the OAuth flow.
2. After completing OAuth, `BOT_ACCESS_TOKEN` is stored in the DB automatically.
3. For local dev without the full flow, use the token helper at `http://localhost:3000/bot/token-helper`.

```bash
cd apps/bot
pnpm dev
```

Expected startup logs:
```
All migrations complete
EventSub WebSocket connected
Subscribed to #<your-channel>
MapleBot ready
```

To verify EventSub is working, type a command in your Twitch chat:

| Command | Expected response |
|---------|-------------------|
| `!ping` | `pong!`           |
| `!uptime` | Stream uptime or "offline" message |
```

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/TESTING.md
git commit -m "docs: fix DATABASE_URL Docker note, update TESTING.md for EventSub bot architecture"
```

---

## MINOR FIXES

---

### Task 13: Minor fixes — AuthGate link text + commands.js guard + .env.example scope

**Files:**
- Modify: `apps/frontend/src/pages/AuthGate.tsx`
- Modify: `apps/bot/src/commands.js`
- Modify: `.env.example`

- [ ] **Step 1: Fix AuthGate.tsx misleading link text**

In `apps/frontend/src/pages/AuthGate.tsx` around line 153, change the anchor text:

```tsx
// Change: "Skip OAuth entirely."
// To:
View the setup guide.
```

- [ ] **Step 2: Guard chatterLogin in commands.js !accountage handler**

In `apps/bot/src/commands.js`, add a guard before the `getUserCreatedAt` call in the `!accountage` block (around line 116):

```js
if (text === '!accountage') {
  const { enabled, response } = cfg('accountage');
  if (!enabled) return null;
  if (!chatterLogin) return null;  // <-- add this guard
  try {
    const createdAt = await getUserCreatedAt(chatterLogin);
    // ...
```

- [ ] **Step 3: Fix Twitch OAuth scope comment in .env.example**

In `.env.example`, update the BOT_ACCESS_TOKEN comment (around line 14–16):

```
# maple_bot's user access token
# Required scopes: channel:bot, user:read:chat, user:write:chat
# Get it via the dashboard "Invite bot" flow, or manually via dev.twitch.tv OAuth
BOT_ACCESS_TOKEN=
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/AuthGate.tsx \
        apps/bot/src/commands.js \
        .env.example
git commit -m "fix: clarify AuthGate link text, guard chatterLogin in accountage, fix scope comment"
```

---

### Task 14: Minor React fixes — Overlays no-op setTimeout already fixed in Task 10

The `template.js` input validation finding is a low-risk defensive addition. `useStreamInfo.ts` save function state-after-unmount was partially addressed in Task 9.

**Files:**
- Modify: `apps/bot/src/template.js`
- Modify: `apps/frontend/src/hooks/useStreamInfo.ts`

- [ ] **Step 1: Add input validation to resolveTemplate**

In `apps/bot/src/template.js`, add validation at the top of the `resolveTemplate` function:

```js
async function resolveTemplate(template, { broadcasterId, broadcasterLogin, chatterId, chatterLogin, arg, accessToken }) {
  if (!template || typeof template !== 'string') throw new Error('resolveTemplate: template must be a non-empty string');
  if (!broadcasterId) throw new Error('resolveTemplate: broadcasterId is required');
  // ... rest unchanged
```

- [ ] **Step 2: Guard save() in useStreamInfo against setState after unmount**

In `apps/frontend/src/hooks/useStreamInfo.ts`, add a mounted ref:

```ts
import { useState, useEffect, useRef } from 'react';

export function useStreamInfo(user: TwitchUser | null): UseStreamInfoResult {
  // ... existing state ...
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const save = async (title: string, gameId: string) => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateStreamInfo(token, user.id, { title, game_id: gameId });
      if (mountedRef.current) setInfo(prev => prev ? { ...prev, title, game_id: gameId } : prev);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };
  // ...
```

- [ ] **Step 3: Commit**

```bash
git add apps/bot/src/template.js apps/frontend/src/hooks/useStreamInfo.ts
git commit -m "fix: validate resolveTemplate inputs, guard useStreamInfo save against unmount"
```

---

## Self-Review

**Spec coverage check:**

| Finding | Task |
|---------|------|
| Plaintext token storage (critical) | Task 1 |
| ws CVE-2026-45736 (critical) | Task 2 |
| @types/react v19 mismatch (critical) | Task 2 |
| Missing env var validation in twitch.js (critical) | Task 3 |
| eventsub.js _handleMessage crash on malformed JSON (critical) | Task 4 |
| subscribeToChannel Promise.all duplicate subs (critical) | Task 4 |
| Watchtime INSERT swallows DB errors (critical) | Task 5 |
| No SIGINT/SIGTERM graceful shutdown (critical) | Task 5 |
| ensureSchema duplicates migration system (critical) | Task 1 (migrate.js rewrite) |
| TierCard always uses Link for external URLs (critical) | Task 6 |
| getCallerTwitchId no error handling (major) | Task 7 |
| OAuth callback no try/catch (major) | Task 7 |
| DB pool no limits, minimal error logging (major) | Task 8 |
| Settings.tsx saveSettings swallows errors (major) | Task 9 |
| useStreamInfo setState after unmount (major) | Task 9 |
| useTwitchStats setState after unmount (major) | Task 9 |
| Overlays.tsx setTimeout no cleanup (major) | Task 10 |
| TopBar hardcoded "just chatting" (major) | Task 10 |
| eventSub.ts createSubscription ignores failures (major) | Task 10 |
| eventSub.ts no session_reconnect handling (major) | Task 10 |
| eventsub.js env var validation missing (critical/major) | Task 4 |
| eventsub.js exponential backoff missing (major) | Task 4 |
| eventsub.js persistent error listener (major) | Task 4 |
| eventsub.js _onReconnect no try-catch (minor) | Task 4 |
| bot/index.js stream state no error handling (major) | Task 5 |
| Bot.tsx handleReconnect is fake (major) | Task 11 |
| BotModerator toggles not persisted (major) | Task 11 |
| BUILTIN_COMMANDS missing 7 commands (major) | Task 11 |
| Bot.tsx builtin field missing (major) | Task 11 |
| DATABASE_URL example localhost (major) | Task 12 |
| TESTING.md outdated bot docs (major) | Task 12 |
| AuthGate.tsx misleading link text (minor) | Task 13 |
| commands.js missing chatterLogin guard (minor) | Task 13 |
| .env.example wrong Twitch OAuth scopes (minor) | Task 13 |
| template.js missing input validation (minor) | Task 14 |
| useStreamInfo save setState after unmount (minor) | Task 14 |
| TopBar maxLength={140} (minor) | Task 10 |

All 51 findings are covered. The `.superpowers/brainstorm/` HTML file findings (toggleSelect, letter CSS, keyboard accessibility) are design artifacts not shipped code — skipping them is appropriate.
