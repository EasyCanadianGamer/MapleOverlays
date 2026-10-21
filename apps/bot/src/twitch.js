const REQUIRED = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'BOT_USER_ID'];
for (const name of REQUIRED) {
  if (!process.env[name]) throw new Error(`Missing required env var: ${name}`);
}

const pool = require('./db');

let appAccessToken = null;
let tokenExpiry = 0;

async function loadBotTokensFromDb() {
  try {
    const { rows } = await pool.query('SELECT access_token, refresh_token FROM bot_tokens WHERE id = 1');
    if (rows.length) {
      process.env.BOT_ACCESS_TOKEN = rows[0].access_token;
      process.env.BOT_REFRESH_TOKEN = rows[0].refresh_token;
      console.log('Bot tokens loaded from database');
    }
  } catch (err) {
    console.warn('Could not load bot tokens from DB (table may not exist yet):', err.message);
  }
}

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
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return appAccessToken;
}

async function sendMessage(broadcasterId, message) {
  if (!broadcasterId) throw new Error('sendMessage: broadcasterId is required');
  if (!message || message.length > 500) throw new Error(`sendMessage: message must be 1–500 chars (got ${message?.length ?? 0})`);
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
  // data is an array — one element if live, empty if offline
  return data[0] ?? null;
}

async function getChannelInfo(broadcasterId) {
  const token = await getAppAccessToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`,
    { headers: { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } },
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data[0] ?? null;
}

async function getUserIdByLogin(login) {
  const token = await getAppAccessToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
    { headers: { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } },
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data[0]?.id ?? null;
}

async function getFollowAge(broadcasterToken, broadcasterId, userId) {
  const res = await fetch(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&user_id=${userId}`,
    { headers: { Authorization: `Bearer ${broadcasterToken}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } },
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data[0]?.followed_at ?? null;
}

async function getSubAge(broadcasterToken, broadcasterId, userId) {
  const res = await fetch(
    `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&user_id=${userId}`,
    { headers: { Authorization: `Bearer ${broadcasterToken}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } },
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const { data } = await res.json();
  return data[0] ?? null;
}

async function getUserCreatedAt(login) {
  const token = await getAppAccessToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
    { headers: { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } },
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data[0]?.created_at ?? null;
}

async function deleteMessage(broadcasterId, messageId) {
  if (!process.env.BOT_ACCESS_TOKEN) return;
  const attempt = (token) => fetch(
    `https://api.twitch.tv/helix/chat/messages?broadcaster_id=${broadcasterId}&moderator_id=${process.env.BOT_USER_ID}&message_id=${messageId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } }
  );
  let res = await attempt(process.env.BOT_ACCESS_TOKEN);
  if (res.status === 401 && process.env.BOT_REFRESH_TOKEN) {
    const newToken = await refreshBotToken();
    res = await attempt(newToken);
  }
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    console.error(`deleteMessage failed (${res.status}):`, text);
  }
}

async function timeoutUser(broadcasterId, userId, durationSeconds, reason) {
  if (!process.env.BOT_ACCESS_TOKEN) return;
  const attempt = (token) => fetch(
    `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${process.env.BOT_USER_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { user_id: userId, duration: durationSeconds, reason } }),
    }
  );
  let res = await attempt(process.env.BOT_ACCESS_TOKEN);
  if (res.status === 401 && process.env.BOT_REFRESH_TOKEN) {
    const newToken = await refreshBotToken();
    res = await attempt(newToken);
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`timeoutUser failed (${res.status}):`, text);
  }
}

let _refreshPromise = null;

async function refreshBotToken() {
  if (_refreshPromise) return _refreshPromise;
  if (!process.env.BOT_REFRESH_TOKEN) throw new Error('BOT_REFRESH_TOKEN not set — cannot refresh');
  _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function _doRefresh() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: process.env.BOT_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bot token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  process.env.BOT_ACCESS_TOKEN = data.access_token;
  if (data.refresh_token) process.env.BOT_REFRESH_TOKEN = data.refresh_token;
  // Persist so the refreshed tokens survive a container restart
  await pool.query(
    `INSERT INTO bot_tokens (id, access_token, refresh_token, updated_at)
     VALUES (1, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET access_token = $1, refresh_token = $2, updated_at = NOW()`,
    [process.env.BOT_ACCESS_TOKEN, process.env.BOT_REFRESH_TOKEN]
  ).catch(err => console.error('Failed to persist refreshed bot token:', err.message));
  console.log('Bot access token refreshed and saved to database');
  return data.access_token;
}

module.exports = { loadBotTokensFromDb, getAppAccessToken, refreshBotToken, sendMessage, getBroadcasterStream, getChannelInfo, getUserIdByLogin, getFollowAge, getSubAge, getUserCreatedAt, deleteMessage, timeoutUser };
