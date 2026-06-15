const REQUIRED = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'BOT_USER_ID'];
for (const name of REQUIRED) {
  if (!process.env[name]) throw new Error(`Missing required env var: ${name}`);
}

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
  const token = process.env.BOT_ACCESS_TOKEN;
  if (!token) return;
  const res = await fetch(
    `https://api.twitch.tv/helix/chat/messages?broadcaster_id=${broadcasterId}&moderator_id=${process.env.BOT_USER_ID}&message_id=${messageId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
      },
    }
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    console.error(`deleteMessage failed (${res.status}):`, text);
  }
}

async function timeoutUser(broadcasterId, userId, durationSeconds, reason) {
  const token = process.env.BOT_ACCESS_TOKEN;
  if (!token) return;
  const res = await fetch(
    `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${process.env.BOT_USER_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { user_id: userId, duration: durationSeconds, reason } }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    console.error(`timeoutUser failed (${res.status}):`, text);
  }
}

module.exports = { getAppAccessToken, sendMessage, getBroadcasterStream, getChannelInfo, getUserIdByLogin, getFollowAge, getSubAge, getUserCreatedAt, deleteMessage, timeoutUser };
