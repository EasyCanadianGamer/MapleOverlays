const express = require('express');
const router = express.Router();
const pool = require('../db');
const { encrypt } = require('../crypto');

const BUILTIN_COMMANDS = new Set(['ping', 'song', 'uptime', 'downtime', 'followage', 'accountage', 'watchtime', 'tip', 'commands']);
const CMD_NAME_RE = /^[a-z0-9_]{1,20}$/;
const MAX_RESPONSE_LEN = 500;

function sanitizeResponse(text) {
  if (typeof text !== 'string') return null;
  // Strip null bytes and non-printable ASCII control chars (keep tab/newline)
  const clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, MAX_RESPONSE_LEN).trim();
  return clean || null;
}

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

router.get('/auth/bot/user-token', (req, res) => {
  const scopes = 'user:bot user:write:chat user:read:chat moderator:manage:chat_messages moderator:manage:banned_users';
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID);
  url.searchParams.set('redirect_uri', process.env.TWITCH_BOT_CALLBACK_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', 'bot_setup');
  url.searchParams.set('force_verify', 'true');
  res.redirect(url.toString());
});

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

    if (req.query.state === 'bot_setup') {
      return res.send(`<!doctype html><html><head><title>Bot Token</title>
<style>body{font-family:monospace;padding:2rem;background:#0e0e10;color:#efeff1}
pre{background:#18181b;padding:1rem;border-radius:6px;word-break:break-all;white-space:pre-wrap}
h2{color:#a970ff}p{color:#adadb8}</style></head><body>
<h2>Bot tokens — copy these to your .env</h2>
<p>Add or replace these two lines in your root <code>.env</code> file, then rebuild the bot:</p>
<pre>BOT_ACCESS_TOKEN=${access_token}
BOT_REFRESH_TOKEN=${refresh_token}</pre>
<p>Then run: <code>docker compose up --build -d bot</code></p>
</body></html>`);
    }

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
             bot_active    = FALSE,
             updated_at    = NOW()`,
      [user.id, user.login, encrypt(access_token), encrypt(refresh_token)]
    );

    const state = req.query.state ? `&state=${encodeURIComponent(req.query.state)}` : '';
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/bot/settings?invited=true${state}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('Internal server error');
  }
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

router.get('/bot/commands', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { rows } = await pool.query(
      'SELECT command, enabled, response, count FROM command_configs WHERE twitch_user_id = $1',
      [callerId]
    );
    res.json(rows.map(r => ({ ...r, builtin: BUILTIN_COMMANDS.has(r.command) })));
  } catch (err) {
    console.error('GET /bot/commands error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/bot/commands', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const { command, enabled, response } = req.body ?? {};
  if (!command) return res.status(400).json({ error: 'Missing command' });
  if (!CMD_NAME_RE.test(command)) {
    return res.status(400).json({ error: 'Invalid command name. Use 1–20 lowercase letters, digits, or underscores.' });
  }

  const cleanResponse = sanitizeResponse(response);

  await pool.query(
    `INSERT INTO command_configs (twitch_user_id, command, enabled, response)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (twitch_user_id, command) DO UPDATE
       SET enabled  = EXCLUDED.enabled,
           response = EXCLUDED.response`,
    [callerId, command, enabled ?? true, cleanResponse]
  );
  res.json({ ok: true });
});

router.delete('/bot/commands/:command', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const { command } = req.params;
  if (!CMD_NAME_RE.test(command)) return res.status(400).json({ error: 'Invalid command name' });
  if (BUILTIN_COMMANDS.has(command)) return res.status(403).json({ error: 'Cannot delete built-in commands' });

  const result = await pool.query(
    'DELETE FROM command_configs WHERE twitch_user_id = $1 AND command = $2',
    [callerId, command]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Command not found' });
  res.json({ ok: true });
});

router.get('/settings', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const { rows } = await pool.query(
    'SELECT lastfm_username, tip_url FROM channels WHERE twitch_user_id = $1',
    [callerId]
  );
  res.json({
    lastfm_username: rows[0]?.lastfm_username ?? '',
    tip_url:         rows[0]?.tip_url         ?? '',
  });
});

router.put('/settings', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const rawLastfm = req.body?.lastfm_username;
  const rawTip    = req.body?.tip_url;

  const lastfm_username = typeof rawLastfm === 'string' ? rawLastfm.trim().slice(0, 64)  || null : null;
  const tip_url         = typeof rawTip    === 'string' ? rawTip.trim().slice(0, 512)    || null : null;

  const result = await pool.query(
    'UPDATE channels SET lastfm_username = $1, tip_url = $2 WHERE twitch_user_id = $3',
    [lastfm_username, tip_url, callerId]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Channel not found — invite the bot first via the Bot Setup page.' });
  }
  res.json({ ok: true });
});

// Public — no auth required. Returns enabled commands for a channel by login.
router.get('/channels/:login/commands', async (req, res) => {
  const { login } = req.params;
  const channel = await pool.query(
    'SELECT twitch_user_id FROM channels WHERE twitch_login = $1',
    [login.toLowerCase()]
  );
  if (channel.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });

  const channelId = channel.rows[0].twitch_user_id;
  const { rows } = await pool.query(
    'SELECT command, enabled, response FROM command_configs WHERE twitch_user_id = $1',
    [channelId]
  );

  // Build override map from DB rows
  const configMap = Object.fromEntries(rows.map(r => [r.command, r]));

  const result = [];

  // Built-ins are enabled by default — only excluded if explicitly disabled in DB
  for (const cmd of BUILTIN_COMMANDS) {
    const override = configMap[cmd];
    if (override && !override.enabled) continue;
    result.push({ command: cmd, enabled: true, response: override?.response ?? null, builtin: true });
  }

  // Custom commands — non-builtin rows that are enabled and have a response template
  for (const row of rows) {
    if (BUILTIN_COMMANDS.has(row.command)) continue;
    if (!row.enabled || !row.response) continue;
    result.push({ command: row.command, enabled: true, response: row.response, builtin: false });
  }

  res.json(result);
});

router.post('/bot/reconnect', async (req, res) => {
  try {
    const callerId = await getCallerTwitchId(req);
    if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
    await pool.query(
      'UPDATE channels SET reconnect_requested_at = NOW() WHERE twitch_user_id = $1',
      [callerId]
    );
    res.json({ ok: true, message: 'Reconnect requested. Bot will re-subscribe within 30 seconds.' });
  } catch (err) {
    console.error('POST /bot/reconnect error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/bot/activity', async (req, res) => {
  try {
    const callerId = await getCallerTwitchId(req);
    if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
    const { rows } = await pool.query(
      `SELECT event_type, user_login, extra_data, created_at
       FROM channel_events
       WHERE channel_user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [callerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /bot/activity error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/bot/automod', async (req, res) => {
  try {
    const callerId = await getCallerTwitchId(req);
    if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
    const { rows } = await pool.query(
      'SELECT automod_settings FROM channels WHERE twitch_user_id = $1',
      [callerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Channel not found' });
    res.json({ automod_settings: rows[0].automod_settings });
  } catch (err) {
    console.error('GET /bot/automod error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/bot/automod', async (req, res) => {
  try {
    const callerId = await getCallerTwitchId(req);
    if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
    const settings = req.body?.automod_settings;
    if (!Array.isArray(settings) || settings.length !== 4 || !settings.every(v => typeof v === 'boolean')) {
      return res.status(400).json({ error: 'automod_settings must be an array of 4 booleans' });
    }
    await pool.query(
      'UPDATE channels SET automod_settings = $1 WHERE twitch_user_id = $2',
      [JSON.stringify(settings), callerId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /bot/automod error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Public — no auth needed; returns the last time !song was used in this channel
router.get('/nowplaying/triggered', async (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ error: 'Missing channel' });
  try {
    const { rows } = await pool.query(
      'SELECT nowplaying_triggered_at FROM channels WHERE twitch_login = $1',
      [channel]
    );
    res.json({ triggered_at: rows[0]?.nowplaying_triggered_at ?? null });
  } catch (err) {
    console.error('GET /nowplaying/triggered error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Timers ────────────────────────────────────────────────────────────────────

const MAX_TIMERS = 20;
const MAX_TIMER_NAME_LEN = 50;
const MAX_TIMER_MSG_LEN = 500;

router.get('/bot/timers', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM bot_timers WHERE twitch_user_id = $1 ORDER BY id',
      [callerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /bot/timers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
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
  if (typeof enabled !== 'boolean')
    return res.status(400).json({ error: 'enabled must be a boolean' });

  try {
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
  } catch (err) {
    console.error('POST /bot/timers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/bot/timers/:id', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const timerId = parseInt(req.params.id, 10);
  if (!Number.isInteger(timerId)) return res.status(400).json({ error: 'Invalid timer id' });

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
  if (enabled !== undefined && typeof enabled !== 'boolean')
    return res.status(400).json({ error: 'enabled must be a boolean' });

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM bot_timers WHERE id = $1 AND twitch_user_id = $2',
      [timerId, callerId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Timer not found' });

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
  } catch (err) {
    console.error('PUT /bot/timers/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/bot/timers/:id', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const timerId = parseInt(req.params.id, 10);
  if (!Number.isInteger(timerId)) return res.status(400).json({ error: 'Invalid timer id' });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM bot_timers WHERE id = $1 AND twitch_user_id = $2',
      [timerId, callerId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Timer not found' });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /bot/timers/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Counters ──────────────────────────────────────────────────────────────────

router.get('/bot/counters', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows } = await pool.query(
      `SELECT command, response, count FROM command_configs
       WHERE twitch_user_id = $1 AND response LIKE '%{count}%'
       ORDER BY command`,
      [callerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /bot/counters error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/bot/counters/:command', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const cmdName = req.params.command;
  if (!CMD_NAME_RE.test(cmdName)) return res.status(400).json({ error: 'Invalid command name' });

  const { count } = req.body ?? {};

  if (!Number.isInteger(count) || count < 0)
    return res.status(400).json({ error: 'count must be a non-negative integer' });

  try {
    const { rowCount } = await pool.query(
      'UPDATE command_configs SET count = $1 WHERE twitch_user_id = $2 AND command = $3',
      [count, callerId, cmdName]
    );
    if (!rowCount) return res.status(404).json({ error: 'Command not found' });
    res.json({ command: cmdName, count });
  } catch (err) {
    console.error('PUT /bot/counters/:command error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/bot/target-counts/:command', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const cmdName = req.params.command;
  if (!CMD_NAME_RE.test(cmdName)) return res.status(400).json({ error: 'Invalid command name' });

  try {
    const { rows } = await pool.query(
      `SELECT target, count FROM command_target_counts
       WHERE twitch_user_id = $1 AND command = $2
       ORDER BY count DESC
       LIMIT 25`,
      [callerId, cmdName]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /bot/target-counts/:command error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/bot/target-counts/:command/:target', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const cmdName = req.params.command;
  if (!CMD_NAME_RE.test(cmdName)) return res.status(400).json({ error: 'Invalid command name' });

  const target = req.params.target;
  if (!target || target.length > 25) return res.status(400).json({ error: 'Invalid target' });

  const { count } = req.body ?? {};
  if (!Number.isInteger(count) || count < 0)
    return res.status(400).json({ error: 'count must be a non-negative integer' });

  try {
    const { rowCount } = await pool.query(
      'UPDATE command_target_counts SET count = $1 WHERE twitch_user_id = $2 AND command = $3 AND target = $4',
      [count, callerId, cmdName, target]
    );
    if (!rowCount) return res.status(404).json({ error: 'Target count not found' });
    res.json({ command: cmdName, target, count });
  } catch (err) {
    console.error('PUT /bot/target-counts/:command/:target error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
