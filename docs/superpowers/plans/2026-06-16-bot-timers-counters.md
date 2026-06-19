# Bot Timers & Counters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-posting timers and per-command use counters to the Twitch bot, with full dashboard management UI.

**Architecture:** Timers live in a new `bot_timers` DB table; the bot polls them every 60 s in a `setInterval` loop using `manager.subscribedChannels` for active channel IDs. Counters are stored as a `count` column on the existing `command_configs` table, incremented atomically via two new template variables (`{count}`, `{getcount X}`) in `template.js`. Both features get dedicated dashboard pages nested under the Bot sidebar section.

**Tech Stack:** Node.js (CommonJS), Express, PostgreSQL (`pg`), React 18 + TypeScript, Vite, `node:test` for bot unit tests.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/api/migrations/007_timers_counters.sql` | Add `bot_timers` table + `count` column on `command_configs` |
| Modify | `apps/bot/src/template.js` | Add `{count}` / `{getcount X}` resolvers; accept optional `db` param for testability |
| Modify | `apps/bot/src/commands.js` | Add `command` field to local `ctx` object (needed by `{count}`) |
| Create | `apps/bot/test/template.test.js` | Unit tests for counter template variables |
| Modify | `apps/bot/src/eventsub.js` | Add `getChannelIds()` method exposing `subscribedChannels` |
| Modify | `apps/bot/src/index.js` | Add chat-line Maps, timer loop (`startTimerLoop`), shutdown cleanup |
| Modify | `apps/api/src/routes/bot.js` | Add timer CRUD routes + counter read/set routes |
| Modify | `apps/frontend/src/components/layout/Sidebar.tsx` | Add `bot-timers` / `bot-counters` to `BOT_SUB_ITEMS` |
| Modify | `apps/frontend/src/components/layout/DashboardLayout.tsx` | Wire new `ViewId` values, paths, and page components |
| Create | `apps/frontend/src/pages/BotTimers.tsx` | Timer list + inline edit UI |
| Create | `apps/frontend/src/pages/BotCounters.tsx` | Counter list + +/−/reset/set UI |

---

## Task 1: Database Migration

**Files:**
- Create: `apps/api/migrations/007_timers_counters.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- apps/api/migrations/007_timers_counters.sql
CREATE TABLE IF NOT EXISTS bot_timers (
  id               SERIAL      PRIMARY KEY,
  twitch_user_id   TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  message          TEXT        NOT NULL,
  online_interval  INT         NOT NULL DEFAULT 0,
  offline_interval INT         NOT NULL DEFAULT 0,
  chat_lines       INT         NOT NULL DEFAULT 0,
  enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  last_fired_at    TIMESTAMPTZ,
  UNIQUE (twitch_user_id, name)
);

ALTER TABLE command_configs ADD COLUMN IF NOT EXISTS count INT NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/api && pnpm migrate
```

Expected output includes: `Running migration: 007_timers_counters.sql`

---

## Task 2: Counter Template Variables

**Files:**
- Modify: `apps/bot/src/template.js`
- Modify: `apps/bot/src/commands.js`
- Create: `apps/bot/test/template.test.js`

- [ ] **Step 1: Write failing tests**

Create `apps/bot/test/template.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTemplate } = require('../src/template');

// Mock DB pool — simulates command_configs.count = 4, then 5 after increment
function makeMockDb(returnCount) {
  return {
    query: async (_sql, _params) => ({ rows: [{ count: returnCount }] }),
  };
}

test('{count} increments and returns the new count', async () => {
  const db = makeMockDb(5);
  const result = await resolveTemplate(
    'Deaths: {count}',
    { broadcasterId: 'ch1', command: 'deaths' },
    { db }
  );
  assert.equal(result, 'Deaths: 5');
});

test('{count} returns 0 when command is missing from ctx', async () => {
  const db = { query: async () => ({ rows: [] }) };
  const result = await resolveTemplate(
    'Count: {count}',
    { broadcasterId: 'ch1' },
    { db }
  );
  assert.equal(result, 'Count: 0');
});

test('{getcount deaths} reads another command count without incrementing', async () => {
  const db = makeMockDb(14);
  const result = await resolveTemplate(
    'Total deaths: {getcount deaths}',
    { broadcasterId: 'ch1', command: 'othercommand' },
    { db }
  );
  assert.equal(result, 'Total deaths: 14');
});

test('{getcount unknown} returns 0 when command not found', async () => {
  const db = { query: async () => ({ rows: [] }) };
  const result = await resolveTemplate(
    'Value: {getcount nope}',
    { broadcasterId: 'ch1', command: 'x' },
    { db }
  );
  assert.equal(result, 'Value: 0');
});

test('template with no counter variables is unaffected', async () => {
  const db = { query: async () => { throw new Error('should not query'); } };
  const result = await resolveTemplate(
    'Hello {user}!',
    { broadcasterId: 'ch1', command: 'hi', chatterLogin: 'alice' },
    { db }
  );
  assert.equal(result, 'Hello alice!');
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd apps/bot && node --test test/template.test.js
```

Expected: failures because `resolveTemplate` doesn't accept a third arg yet.

- [ ] **Step 3: Add `command` to ctx in commands.js**

In `apps/bot/src/commands.js`, the local `ctx` is built at line 62. Change it to include `command`:

```js
// Before (line 62):
const ctx = { broadcasterId, broadcasterLogin, chatterId, chatterLogin, arg, accessToken };

// After:
const commandName = parts[0]?.toLowerCase() ?? null;
const ctx = { broadcasterId, broadcasterLogin, chatterId, chatterLogin, arg, accessToken, command: commandName };
```

`parts` is already defined on the line above (line 59): `const parts = text.startsWith('!') ? text.slice(1).split(/\s+/) : [];`

- [ ] **Step 4: Implement counter variables in template.js**

Replace the full contents of `apps/bot/src/template.js` with:

```js
const {
  getBroadcasterStream,
  getChannelInfo,
  getUserIdByLogin,
  getFollowAge,
  getSubAge,
} = require('./twitch');
const defaultPool = require('./db');

function sinceWhen(isoString) {
  const days = Math.floor((Date.now() - new Date(isoString).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}yr`;
}

async function resolveTemplate(template, { broadcasterId, broadcasterLogin, chatterId, chatterLogin, arg, accessToken, command } = {}, { db } = {}) {
  if (typeof template !== 'string') return '';
  const pool = db ?? defaultPool;

  // Collect unique variable names used in this template
  const used = new Set();
  for (const [, key] of template.matchAll(/\{([^}]+)\}/g)) {
    used.add(key === 'channel.game' ? 'game' : key);
  }

  if (used.size === 0) return template;

  // Shared promises — deduplicates API calls when multiple vars need the same fetch
  let streamPromise = null;
  let chatterIdPromise = null;

  function getStream() {
    streamPromise ??= getBroadcasterStream(broadcasterId).catch(() => null);
    return streamPromise;
  }

  function getChatterId() {
    if (chatterId) return Promise.resolve(chatterId);
    chatterIdPromise ??= getUserIdByLogin(chatterLogin).catch(() => null);
    return chatterIdPromise;
  }

  // Build resolver map — only for vars that are actually used
  const resolvers = {};

  if (used.has('channel'))  resolvers['channel']  = async () => broadcasterLogin ?? '';
  if (used.has('user'))     resolvers['user']      = async () => chatterLogin ?? '';
  if (used.has('1'))        resolvers['1']         = async () => arg ?? '';

  if (used.has('game')) {
    resolvers['game'] = async () => {
      try {
        const stream = await getStream();
        if (stream?.game_name) return stream.game_name;
        const channel = await getChannelInfo(broadcasterId);
        return channel?.game_name ?? '[unavailable]';
      } catch { return '[unavailable]'; }
    };
  }

  if (used.has('channel.viewers')) {
    resolvers['channel.viewers'] = async () => {
      try {
        const stream = await getStream();
        return stream?.viewer_count != null ? String(stream.viewer_count) : '0';
      } catch { return '[unavailable]'; }
    };
  }

  if (used.has('1.game')) {
    resolvers['1.game'] = async () => {
      if (!arg) return '[unavailable]';
      try {
        const userId = await getUserIdByLogin(arg);
        if (!userId) return '[unavailable]';
        const stream = await getBroadcasterStream(userId);
        return stream?.game_name ?? '[not live]';
      } catch { return '[unavailable]'; }
    };
  }

  if (used.has('user.follow')) {
    resolvers['user.follow'] = async () => {
      if (!accessToken) return '[unavailable]';
      try {
        const uid = await getChatterId();
        if (!uid) return '[unavailable]';
        const followedAt = await getFollowAge(accessToken, broadcasterId, uid);
        return followedAt ? sinceWhen(followedAt) : '[not following]';
      } catch { return '[unavailable]'; }
    };
  }

  if (used.has('user.subscribe')) {
    resolvers['user.subscribe'] = async () => {
      if (!accessToken) return '[unavailable]';
      try {
        const uid = await getChatterId();
        if (!uid) return '[unavailable]';
        const sub = await getSubAge(accessToken, broadcasterId, uid);
        if (!sub) return '[not subscribed]';
        const tiers = { '1000': 'Tier 1', '2000': 'Tier 2', '3000': 'Tier 3' };
        return tiers[sub.tier] ?? 'subscriber';
      } catch { return '[unavailable]'; }
    };
  }

  // {count} — atomically increment this command's counter and return new value
  if (used.has('count')) {
    resolvers['count'] = async () => {
      if (!broadcasterId || !command) return '0';
      try {
        const { rows } = await pool.query(
          'UPDATE command_configs SET count = count + 1 WHERE twitch_user_id = $1 AND command = $2 RETURNING count',
          [broadcasterId, command]
        );
        return String(rows[0]?.count ?? 0);
      } catch { return '0'; }
    };
  }

  // {getcount commandname} — read another command's count without incrementing
  for (const key of used) {
    if (key.startsWith('getcount ')) {
      const targetCmd = key.slice('getcount '.length).trim();
      resolvers[key] = async () => {
        if (!broadcasterId || !targetCmd) return '0';
        try {
          const { rows } = await pool.query(
            'SELECT count FROM command_configs WHERE twitch_user_id = $1 AND command = $2',
            [broadcasterId, targetCmd]
          );
          return String(rows[0]?.count ?? 0);
        } catch { return '0'; }
      };
    }
  }

  // Resolve all used vars in parallel
  const keys = Object.keys(resolvers);
  const values = await Promise.all(keys.map(k => resolvers[k]()));
  const resolved = Object.fromEntries(keys.map((k, i) => [k, values[i]]));

  // Substitute — normalize channel.game alias to the resolved game value
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const normalized = key === 'channel.game' ? 'game' : key;
    return resolved[normalized] ?? '';
  });
}

module.exports = { resolveTemplate };
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd apps/bot && node --test test/template.test.js
```

Expected: all 5 tests pass.

- [ ] **Step 6: Run the full bot test suite to check for regressions**

```bash
cd apps/bot && pnpm test
```

Expected: all existing tests still pass.

---

## Task 3: Timer & Counter API Routes

**Files:**
- Modify: `apps/api/src/routes/bot.js`

- [ ] **Step 1: Add timer CRUD routes**

Append to `apps/api/src/routes/bot.js` before the final `module.exports = router`:

```js
// ── Timers ────────────────────────────────────────────────────────────────────

const MAX_TIMERS = 20;
const MAX_TIMER_NAME_LEN = 50;
const MAX_TIMER_MSG_LEN = 500;

router.get('/bot/timers', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
  const { rows } = await pool.query(
    'SELECT * FROM bot_timers WHERE twitch_user_id = $1 ORDER BY id',
    [callerId]
  );
  res.json(rows);
});

router.post('/bot/timers', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const { name, message, online_interval = 0, offline_interval = 0, chat_lines = 0, enabled = true } = req.body ?? {};

  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_TIMER_NAME_LEN)
    return res.status(400).json({ error: 'name must be 1–50 characters' });
  if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > MAX_TIMER_MSG_LEN)
    return res.status(400).json({ error: 'message must be 1–500 characters' });
  if (!Number.isInteger(online_interval) || online_interval < 0)
    return res.status(400).json({ error: 'online_interval must be a non-negative integer (seconds)' });
  if (!Number.isInteger(offline_interval) || offline_interval < 0)
    return res.status(400).json({ error: 'offline_interval must be a non-negative integer (seconds)' });
  if (!Number.isInteger(chat_lines) || chat_lines < 0)
    return res.status(400).json({ error: 'chat_lines must be a non-negative integer' });

  const { rows: existing } = await pool.query(
    'SELECT COUNT(*) FROM bot_timers WHERE twitch_user_id = $1',
    [callerId]
  );
  if (Number(existing[0].count) >= MAX_TIMERS)
    return res.status(400).json({ error: `Maximum ${MAX_TIMERS} timers allowed` });

  const { rows } = await pool.query(
    `INSERT INTO bot_timers (twitch_user_id, name, message, online_interval, offline_interval, chat_lines, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [callerId, name.trim(), message.trim(), online_interval, offline_interval, chat_lines, enabled]
  );
  res.status(201).json(rows[0]);
});

router.put('/bot/timers/:id', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const timerId = parseInt(req.params.id, 10);
  if (!Number.isInteger(timerId)) return res.status(400).json({ error: 'Invalid timer id' });

  const { rows: existing } = await pool.query(
    'SELECT id FROM bot_timers WHERE id = $1 AND twitch_user_id = $2',
    [timerId, callerId]
  );
  if (!existing.length) return res.status(404).json({ error: 'Timer not found' });

  const { name, message, online_interval, offline_interval, chat_lines, enabled } = req.body ?? {};

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_TIMER_NAME_LEN))
    return res.status(400).json({ error: 'name must be 1–50 characters' });
  if (message !== undefined && (typeof message !== 'string' || message.trim().length === 0 || message.length > MAX_TIMER_MSG_LEN))
    return res.status(400).json({ error: 'message must be 1–500 characters' });
  if (online_interval !== undefined && (!Number.isInteger(online_interval) || online_interval < 0))
    return res.status(400).json({ error: 'online_interval must be a non-negative integer (seconds)' });
  if (offline_interval !== undefined && (!Number.isInteger(offline_interval) || offline_interval < 0))
    return res.status(400).json({ error: 'offline_interval must be a non-negative integer (seconds)' });
  if (chat_lines !== undefined && (!Number.isInteger(chat_lines) || chat_lines < 0))
    return res.status(400).json({ error: 'chat_lines must be a non-negative integer' });

  const { rows } = await pool.query(
    `UPDATE bot_timers SET
       name             = COALESCE($3, name),
       message          = COALESCE($4, message),
       online_interval  = COALESCE($5, online_interval),
       offline_interval = COALESCE($6, offline_interval),
       chat_lines       = COALESCE($7, chat_lines),
       enabled          = COALESCE($8, enabled)
     WHERE id = $1 AND twitch_user_id = $2 RETURNING *`,
    [timerId, callerId,
     name?.trim() ?? null, message?.trim() ?? null,
     online_interval ?? null, offline_interval ?? null,
     chat_lines ?? null, enabled ?? null]
  );
  res.json(rows[0]);
});

router.delete('/bot/timers/:id', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const timerId = parseInt(req.params.id, 10);
  if (!Number.isInteger(timerId)) return res.status(400).json({ error: 'Invalid timer id' });

  const { rowCount } = await pool.query(
    'DELETE FROM bot_timers WHERE id = $1 AND twitch_user_id = $2',
    [timerId, callerId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Timer not found' });
  res.status(204).end();
});

// ── Counters ──────────────────────────────────────────────────────────────────

router.get('/bot/counters', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
  const { rows } = await pool.query(
    `SELECT command, response, count FROM command_configs
     WHERE twitch_user_id = $1 AND response LIKE '%{count}%'
     ORDER BY command`,
    [callerId]
  );
  res.json(rows);
});

router.put('/bot/counters/:command', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const cmdName = req.params.command;
  const { count } = req.body ?? {};

  if (!Number.isInteger(count) || count < 0)
    return res.status(400).json({ error: 'count must be a non-negative integer' });

  const { rowCount } = await pool.query(
    'UPDATE command_configs SET count = $1 WHERE twitch_user_id = $2 AND command = $3',
    [count, callerId, cmdName]
  );
  if (!rowCount) return res.status(404).json({ error: 'Command not found' });
  res.json({ command: cmdName, count });
});
```

- [ ] **Step 2: Verify the API starts without errors**

```bash
cd apps/api && pnpm dev
```

Expected: `Listening on port 3000` — no crashes.

---

## Task 4: Timer Loop in Bot

**Files:**
- Modify: `apps/bot/src/eventsub.js`
- Modify: `apps/bot/src/index.js`

- [ ] **Step 1: Add `getChannelIds()` to EventSubManager**

In `apps/bot/src/eventsub.js`, add one method to the `EventSubManager` class, just before the closing `}` of the class (before line 148):

```js
  getChannelIds() {
    return [...this.subscribedChannels];
  }
```

- [ ] **Step 2: Add chat-line tracking Maps to index.js**

In `apps/bot/src/index.js`, add two Maps after the existing `sessionMap` declaration (after line 12):

```js
// broadcasterId → cumulative chat message count (resets on bot restart)
const chatLineCount = new Map();
// timerId → chatLineCount value at the time it last fired
const timerChatCheckpoint = new Map();
```

- [ ] **Step 3: Increment chatLineCount on every message**

In `apps/bot/src/index.js`, inside the `EventSubManager` constructor callback (the big async function starting at line 101), add the increment immediately after the session-tracking block. Find this block:

```js
    // Track watchtime session — record first message time per viewer per session
    if (!sessionMap.has(broadcasterId)) sessionMap.set(broadcasterId, new Map());
    const channelSession = sessionMap.get(broadcasterId);
    if (!channelSession.has(chatterLogin)) channelSession.set(chatterLogin, Date.now());
```

Add immediately after it:

```js
    chatLineCount.set(broadcasterId, (chatLineCount.get(broadcasterId) ?? 0) + 1);
```

- [ ] **Step 4: Add startTimerLoop function**

In `apps/bot/src/index.js`, add this function after the `subscribeAll` function (after line 188):

```js
function startTimerLoop() {
  return setInterval(async () => {
    const channelIds = manager.getChannelIds();
    if (channelIds.length === 0) return;

    let timers;
    try {
      const { rows } = await pool.query(
        `SELECT t.id, t.twitch_user_id, t.message,
                t.online_interval, t.offline_interval, t.chat_lines,
                c.offline_since
         FROM bot_timers t
         JOIN channels c ON c.twitch_user_id = t.twitch_user_id
         WHERE t.twitch_user_id = ANY($1) AND t.enabled = true`,
        [channelIds]
      );
      timers = rows;
    } catch (err) {
      console.error('Timer loop DB query failed:', err.message);
      return;
    }

    const now = Date.now();

    for (const timer of timers) {
      const isOnline = !timer.offline_since;
      const interval = isOnline ? timer.online_interval : timer.offline_interval;
      if (interval === 0) continue;

      const lastFired = timer.last_fired_at ? new Date(timer.last_fired_at).getTime() : 0;
      if (now - lastFired < interval * 1000) continue;

      const channelLines = chatLineCount.get(timer.twitch_user_id) ?? 0;
      const checkpointLines = timerChatCheckpoint.get(timer.id) ?? 0;
      if (channelLines - checkpointLines < timer.chat_lines) continue;

      try {
        await sendMessage(timer.twitch_user_id, timer.message);
        await pool.query(
          'UPDATE bot_timers SET last_fired_at = NOW() WHERE id = $1',
          [timer.id]
        );
        timerChatCheckpoint.set(timer.id, channelLines);
      } catch (err) {
        console.error(`Timer ${timer.id} fire failed for channel ${timer.twitch_user_id}:`, err.message);
      }
    }
  }, 60_000);
}
```

- [ ] **Step 5: Start the timer loop in main() and clear it on shutdown**

In `main()` (around line 230), add the timer loop start after `pollInterval = setInterval(pollNewChannels, 30_000)`:

```js
  pollInterval = setInterval(pollNewChannels, 30_000);
  timerInterval = startTimerLoop();
```

Declare `timerInterval` alongside `pollInterval` (near line 228):

```js
let pollInterval = null;
let timerInterval = null;
```

In `shutdown()`, clear the timer interval alongside `pollInterval`:

```js
  if (pollInterval) clearInterval(pollInterval);
  if (timerInterval) clearInterval(timerInterval);
```

- [ ] **Step 6: Verify bot starts cleanly**

```bash
cd apps/bot && pnpm dev
```

Expected: `MapleBot ready` — no errors. The timer loop starts silently (no channels subscribed in dev).

---

## Task 5: Frontend Navigation

**Files:**
- Modify: `apps/frontend/src/components/layout/Sidebar.tsx`
- Modify: `apps/frontend/src/components/layout/DashboardLayout.tsx`

- [ ] **Step 1: Add bot-timers and bot-counters to BOT_SUB_ITEMS in Sidebar.tsx**

In `apps/frontend/src/components/layout/Sidebar.tsx`, find `BOT_SUB_ITEMS`:

```ts
const BOT_SUB_ITEMS: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: 'bot-commands',  icon: 'terminal', label: 'Commands'  },
  { id: 'bot-settings',  icon: 'settings', label: 'Settings'  },
  { id: 'bot-moderator', icon: 'shield',   label: 'Moderator' },
];
```

Replace with:

```ts
const BOT_SUB_ITEMS: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: 'bot-commands',  icon: 'terminal', label: 'Commands'  },
  { id: 'bot-settings',  icon: 'settings', label: 'Settings'  },
  { id: 'bot-moderator', icon: 'shield',   label: 'Moderator' },
  { id: 'bot-timers',    icon: 'timer',    label: 'Timers'    },
  { id: 'bot-counters',  icon: 'hash',     label: 'Counters'  },
];
```

- [ ] **Step 2: Extend ViewId and isBotView in Sidebar.tsx**

Find:

```ts
export type ViewId = 'manager' | 'overlays' | 'bot-commands' | 'bot-settings' | 'bot-moderator' | 'settings';

export function isBotView(v: ViewId): boolean {
  return v === 'bot-commands' || v === 'bot-settings' || v === 'bot-moderator';
}
```

Replace with:

```ts
export type ViewId = 'manager' | 'overlays' | 'bot-commands' | 'bot-settings' | 'bot-moderator' | 'bot-timers' | 'bot-counters' | 'settings';

export function isBotView(v: ViewId): boolean {
  return v === 'bot-commands' || v === 'bot-settings' || v === 'bot-moderator' || v === 'bot-timers' || v === 'bot-counters';
}
```

- [ ] **Step 3: Wire paths and page components in DashboardLayout.tsx**

In `apps/frontend/src/components/layout/DashboardLayout.tsx`:

Add imports at the top (after the existing page imports):

```ts
import BotTimers from '../../pages/BotTimers';
import BotCounters from '../../pages/BotCounters';
```

In `pathnameToView`, add two new cases (before the `return 'manager'` fallback):

```ts
  if (pathname.startsWith('/dashboard/bot/timers'))   return 'bot-timers';
  if (pathname.startsWith('/dashboard/bot/counters')) return 'bot-counters';
```

In `viewToPath`, add two new cases (before the `default`):

```ts
    case 'bot-timers':    return '/dashboard/bot/timers';
    case 'bot-counters':  return '/dashboard/bot/counters';
```

In the `views` object, add two new entries:

```ts
    'bot-timers':    <BotTimers />,
    'bot-counters':  <BotCounters />,
```

- [ ] **Step 4: Type-check**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: errors about missing `BotTimers` and `BotCounters` modules (the pages don't exist yet) — that's fine. No other errors.

---

## Task 6: BotTimers Page

**Files:**
- Create: `apps/frontend/src/pages/BotTimers.tsx`

- [ ] **Step 1: Create BotTimers.tsx**

```tsx
import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Toggle from '../components/ui/Toggle';
import Icon from '../components/ui/Icon';
import { getToken } from '../lib/twitchAuth';

const apiUrl = import.meta.env.VITE_API_URL as string;

interface Timer {
  id: number;
  name: string;
  message: string;
  online_interval: number;
  offline_interval: number;
  chat_lines: number;
  enabled: boolean;
  last_fired_at: string | null;
}

interface TimerDraft {
  name: string;
  message: string;
  online_interval: string;
  offline_interval: string;
  chat_lines: string;
  enabled: boolean;
}

const emptyDraft = (): TimerDraft => ({
  name: '', message: '',
  online_interval: '15', offline_interval: '0', chat_lines: '0',
  enabled: true,
});

function secsToMins(secs: number): string {
  return secs === 0 ? '0' : String(Math.round(secs / 60));
}

function minsToSecs(mins: string): number {
  const n = parseInt(mins, 10);
  return isNaN(n) || n < 0 ? 0 : n * 60;
}

export default function BotTimers() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<TimerDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/bot/timers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: Timer[]) => setTimers(data))
      .catch(() => setError('Failed to load timers'));
  }, []);

  function startEdit(t: Timer) {
    setDraft({
      name: t.name,
      message: t.message,
      online_interval: secsToMins(t.online_interval),
      offline_interval: secsToMins(t.offline_interval),
      chat_lines: String(t.chat_lines),
      enabled: t.enabled,
    });
    setEditingId(t.id);
  }

  function startCreate() {
    setDraft(emptyDraft());
    setEditingId('new');
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveTimer() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    const body = {
      name: draft.name.trim(),
      message: draft.message.trim(),
      online_interval: minsToSecs(draft.online_interval),
      offline_interval: minsToSecs(draft.offline_interval),
      chat_lines: Math.max(0, parseInt(draft.chat_lines, 10) || 0),
      enabled: draft.enabled,
    };
    try {
      const url = editingId === 'new'
        ? `${apiUrl}/bot/timers`
        : `${apiUrl}/bot/timers/${editingId}`;
      const method = editingId === 'new' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const saved: Timer = await res.json();
      if (editingId === 'new') {
        setTimers(ts => [...ts, saved]);
      } else {
        setTimers(ts => ts.map(t => t.id === saved.id ? saved : t));
      }
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(timer: Timer) {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/bot/timers/${timer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !timer.enabled }),
      });
      if (!res.ok) return;
      const updated: Timer = await res.json();
      setTimers(ts => ts.map(t => t.id === updated.id ? updated : t));
    } catch {}
  }

  async function deleteTimer(id: number) {
    if (!confirm('Delete this timer?')) return;
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${apiUrl}/bot/timers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setTimers(ts => ts.filter(t => t.id !== id));
      if (editingId === id) setEditingId(null);
    } catch {}
  }

  const field = (label: string, key: keyof TimerDraft, placeholder = '') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
      <input
        value={draft[key] as string}
        onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{
          height: 36, padding: '0 12px', borderRadius: 8,
          background: 'var(--bg-1)', border: '1px solid var(--border-2)',
          color: 'var(--ink-0)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
        }}
      />
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Bot</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Timers
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          Auto-post announcements, social links, or reminders on a schedule.
        </div>
      </div>

      <Card style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Eyebrow>Active timers</Eyebrow>
          {editingId !== 'new' && (
            <Button variant="secondary" size="sm" onClick={startCreate}>+ New Timer</Button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {timers.map(t => (
            <div key={t.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'var(--bg-1)',
                border: `1px solid ${editingId === t.id ? 'var(--maple-500)' : 'var(--border-1)'}`,
                borderRadius: 12, opacity: t.enabled ? 1 : 0.55,
              }}>
                <Toggle checked={t.enabled} onChange={() => toggleEnabled(t)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.message}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--maple-400)', fontWeight: 600 }}>
                      {t.online_interval === 0 ? '—' : `${Math.round(t.online_interval / 60)}m`}
                    </span>
                    {' '}online
                  </span>
                  <span style={{ color: 'var(--ink-3)' }}>
                    <span style={{ color: t.offline_interval === 0 ? 'var(--ink-4)' : 'var(--ink-2)', fontWeight: 600 }}>
                      {t.offline_interval === 0 ? 'off' : `${Math.round(t.offline_interval / 60)}m`}
                    </span>
                    {' '}offline
                  </span>
                  <span style={{ color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{t.chat_lines}</span>
                    {' '}lines
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Button variant="secondary" size="sm" onClick={() => editingId === t.id ? cancelEdit() : startEdit(t)}>
                    {editingId === t.id ? 'Cancel' : 'Edit'}
                  </Button>
                  <button
                    onClick={() => deleteTimer(t.id)}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}
                  >
                    <Icon name="trash-2" size={13} />
                  </button>
                </div>
              </div>

              {editingId === t.id && (
                <div style={{ padding: '14px 16px', background: 'var(--bg-0)', border: '1px solid var(--maple-500)', borderTop: 'none', borderRadius: '0 0 12px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {field('Name', 'name')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {field('Online (min)', 'online_interval', '15')}
                      {field('Offline (min)', 'offline_interval', '0')}
                      {field('Chat lines', 'chat_lines', '5')}
                    </div>
                  </div>
                  {field('Message', 'message', 'Check out our Discord at discord.gg/...')}
                  {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <Button variant="secondary" size="sm" onClick={cancelEdit}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={saveTimer} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {editingId === 'new' && (
            <div style={{ padding: '14px 16px', background: 'var(--bg-1)', border: '1px solid var(--maple-500)', borderRadius: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--maple-400)', fontWeight: 600, marginBottom: 12 }}>New timer</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {field('Name', 'name', 'Social Links')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {field('Online (min)', 'online_interval', '15')}
                  {field('Offline (min)', 'offline_interval', '0')}
                  {field('Chat lines', 'chat_lines', '5')}
                </div>
              </div>
              {field('Message', 'message', 'Follow us on Twitter @...')}
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
                Offline interval 0 = timer won't post when stream is offline. Chat lines = min messages since last post.
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Button variant="secondary" size="sm" onClick={cancelEdit}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={saveTimer} disabled={saving}>
                  {saving ? 'Saving…' : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {timers.length === 0 && editingId !== 'new' && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No timers yet. Create one to auto-post messages on a schedule.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: only the missing `BotCounters` error remains.

---

## Task 7: BotCounters Page

**Files:**
- Create: `apps/frontend/src/pages/BotCounters.tsx`

- [ ] **Step 1: Create BotCounters.tsx**

```tsx
import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { getToken } from '../lib/twitchAuth';

const apiUrl = import.meta.env.VITE_API_URL as string;

interface Counter {
  command: string;
  response: string;
  count: number;
}

export default function BotCounters() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [settingCmd, setSettingCmd] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/bot/counters`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: Counter[]) => setCounters(data))
      .catch(() => setError('Failed to load counters'));
  }, []);

  async function updateCount(command: string, newCount: number) {
    const token = getToken();
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/bot/counters/${command}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ count: newCount }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setCounters(cs => cs.map(c => c.command === command ? { ...c, count: newCount } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  function confirmSet(command: string) {
    const n = parseInt(setDraft, 10);
    if (isNaN(n) || n < 0) { setError('Enter a valid non-negative number'); return; }
    updateCount(command, n);
    setSettingCmd(null);
    setSetDraft('');
  }

  const highlightCount = (response: string) => {
    const safe = response
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return safe.replace(/\{count\}/g, '<mark style="background:rgba(193,47,93,.18);color:var(--maple-200);border-radius:3px;padding:0 3px">{count}</mark>');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Bot</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Counters
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          Commands using <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--maple-300)' }}>{'{count}'}</code> — each use increments automatically.
        </div>
      </div>

      <Card style={{ padding: 22 }}>
        <Eyebrow style={{ marginBottom: 14 }}>Counter commands</Eyebrow>

        {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {counters.map(c => (
            <div key={c.command} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 18px', background: 'var(--bg-1)',
              border: '1px solid var(--border-1)', borderRadius: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink-0)' }}>!{c.command}</span>
                  <span
                    style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    dangerouslySetInnerHTML={{ __html: highlightCount(c.response) }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => updateCount(c.command, Math.max(0, c.count - 1))}
                  style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
                >−</button>

                <div style={{ minWidth: 52, textAlign: 'center' }}>
                  {settingCmd === c.command ? (
                    <input
                      autoFocus
                      value={setDraft}
                      onChange={e => setSetDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmSet(c.command); if (e.key === 'Escape') { setSettingCmd(null); setSetDraft(''); } }}
                      style={{ width: 52, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, background: 'var(--bg-2)', border: '1px solid var(--maple-500)', borderRadius: 6, color: 'var(--ink-0)', padding: '2px 4px' }}
                    />
                  ) : (
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-0)', fontFamily: 'var(--font-mono)', lineHeight: 1, cursor: 'pointer' }}
                      onClick={() => { setSettingCmd(c.command); setSetDraft(String(c.count)); }}>
                      {c.count}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => updateCount(c.command, c.count + 1)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
                >+</button>

                {settingCmd === c.command ? (
                  <Button variant="primary" size="sm" onClick={() => confirmSet(c.command)}>Set</Button>
                ) : (
                  <button
                    onClick={() => updateCount(c.command, 0)}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', marginLeft: 4 }}
                  >Reset</button>
                )}
              </div>
            </div>
          ))}

          {counters.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No counter commands yet. Add <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{'{count}'}</code> to any command response in the Commands page.
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--border-1)', borderRadius: 10, fontSize: 12, color: 'var(--ink-3)' }}>
          <div style={{ marginBottom: 4, color: 'var(--ink-2)', fontWeight: 600 }}>Template variables</div>
          <div><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--maple-300)' }}>{'{count}'}</code> — increments this command's counter on each use and shows the value</div>
          <div style={{ marginTop: 2 }}><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--maple-300)' }}>{'{getcount deaths}'}</code> — reads another command's counter without incrementing</div>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Final type-check — expect no errors**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: clean (no errors).

- [ ] **Step 3: Start the frontend dev server and verify manually**

```bash
cd apps/frontend && pnpm dev
```

Open http://localhost:5173. Navigate to Bot → Timers and Bot → Counters. Verify both pages load and both links appear in the sidebar.

---

## Verification Checklist

- [ ] `cd apps/bot && pnpm test` — all tests pass including the new template tests
- [ ] Create a timer (online interval 1 min, chat lines 0) — confirm bot fires it to chat after 60 s
- [ ] Create a `!deaths` command with response `We have died {count} times` — type `!deaths` in chat, count increments
- [ ] Create a `!deathcheck` with response `Deaths so far: {getcount deaths}` — verify it reads without incrementing
- [ ] Dashboard +/−/Reset correctly updates the counter value and it reflects in the next `!deaths` call
- [ ] `docker compose up --build` — all services build and migration 007 runs on API startup
