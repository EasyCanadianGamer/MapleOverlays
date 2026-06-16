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

  const { rows } = await pool.query(
    'SELECT command, enabled, response FROM command_configs WHERE twitch_user_id = $1',
    [callerId]
  );
  res.json(rows.map(r => ({ ...r, builtin: BUILTIN_COMMANDS.has(r.command) })));
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

  await pool.query(
    'UPDATE channels SET lastfm_username = $1, tip_url = $2 WHERE twitch_user_id = $3',
    [lastfm_username, tip_url, callerId]
  );
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

module.exports = router;
