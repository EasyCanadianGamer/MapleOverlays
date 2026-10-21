'use strict';

// Minimal Twitch Helix client using an app access token (client credentials).
// The fetch function is injectable so tests never touch the network.

// Every call is aborted after this long, so a stalled Twitch cannot hold a request open.
const DEFAULT_TIMEOUT_MS = 5000;

let cached = null; // { token, expiresAt }

async function getAppToken(fetchFn = fetch, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const res = await fetchFn('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`App token request failed: ${res.status}`);
  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return cached.token;
}

async function helixGet(path, fetchFn = fetch, opts = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const call = (token) => fetchFn(`https://api.twitch.tv/helix/${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID },
  });
  let res = await call(await getAppToken(fetchFn, opts));
  if (res.status === 401) {
    cached = null;
    res = await call(await getAppToken(fetchFn, opts));
  }
  if (!res.ok) throw new Error(`Helix ${path} failed: ${res.status}`);
  return res.json();
}

async function getUserIdByLogin(login, fetchFn = fetch, opts = {}) {
  const { data } = await helixGet(`users?login=${encodeURIComponent(login)}`, fetchFn, opts);
  return data?.[0]?.id ?? null;
}

function badgeMap(payload) {
  const out = {};
  for (const set of payload?.data ?? []) {
    for (const v of set?.versions ?? []) {
      if (set.set_id != null && v?.id != null && v.image_url_2x) out[`${set.set_id}/${v.id}`] = v.image_url_2x;
    }
  }
  return out;
}

// Global badges first, channel badges override them. A failed half does not fail the other.
async function getBadges(broadcasterId, fetchFn = fetch, opts = {}) {
  const [global, channel] = await Promise.all([
    helixGet('chat/badges/global', fetchFn, opts).catch(() => null),
    helixGet(`chat/badges?broadcaster_id=${encodeURIComponent(broadcasterId)}`, fetchFn, opts).catch(() => null),
  ]);
  return { badges: { ...badgeMap(global), ...badgeMap(channel) }, failed: global === null || channel === null };
}

module.exports = { getUserIdByLogin, getBadges, badgeMap };
