'use strict';

const SEVENTV = 'https://7tv.io/v3';
const BTTV = 'https://api.betterttv.net/3';
const FFZ = 'https://api.frankerfacez.com/v1';

// Emote names come from third parties. Never let one overwrite the object's own prototype.
function put(out, name, url) {
  if (typeof name !== 'string' || !name || name === '__proto__' || typeof url !== 'string' || !url) return;
  out[name] = url;
}

const https = (u) => (u.startsWith('//') ? `https:${u}` : u);

function parse7tvSet(set) {
  const out = {};
  for (const e of set?.emotes ?? []) {
    const host = e?.data?.host?.url;
    if (typeof host === 'string') put(out, e?.name, `${https(host)}/2x.webp`);
  }
  return out;
}

function parseBttvList(list) {
  const out = {};
  if (!Array.isArray(list)) return out;
  for (const e of list) {
    if (e?.id && e?.code) put(out, e.code, `https://cdn.betterttv.net/emote/${e.id}/2x`);
  }
  return out;
}

function parseBttvChannel(body) {
  return { ...parseBttvList(body?.channelEmotes), ...parseBttvList(body?.sharedEmotes) };
}

function parseFfz(body) {
  const out = {};
  const sets = body?.sets && typeof body.sets === 'object' ? Object.values(body.sets) : [];
  for (const set of sets) {
    for (const e of set?.emoticons ?? []) {
      const url = e?.urls?.['2'] ?? e?.urls?.['1'] ?? e?.urls?.['4'];
      if (typeof url === 'string') put(out, e?.name, https(url));
    }
  }
  return out;
}

// Returns the parsed JSON, undefined for a 404 (the user simply has no account
// there), or null for any real failure (error status, network error, timeout).
async function getJson(fetchFn, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal });
    if (res.status === 404) return undefined;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadEmotes(twitchId, { fetchFn = fetch, timeoutMs = 4000 } = {}) {
  const id = encodeURIComponent(twitchId);
  const get = (url) => getJson(fetchFn, url, timeoutMs);
  const [g7, c7, gb, cb, gf, cf] = await Promise.all([
    get(`${SEVENTV}/emote-sets/global`),
    get(`${SEVENTV}/users/twitch/${id}`),
    get(`${BTTV}/cached/emotes/global`),
    get(`${BTTV}/cached/users/twitch/${id}`),
    get(`${FFZ}/set/global`),
    get(`${FFZ}/room/id/${id}`),
  ]);

  const failed = [];
  const note = (name, ...results) => { if (results.some(r => r === null)) failed.push(name); };
  note('sevenTv', g7, c7);
  note('bttv', gb, cb);
  note('ffz', gf, cf);

  return {
    emotes: {
      sevenTv: { ...parse7tvSet(g7), ...parse7tvSet(c7?.emote_set) },
      bttv: { ...parseBttvList(gb), ...parseBttvChannel(cb) },
      ffz: { ...parseFfz(gf), ...parseFfz(cf) },
    },
    failed,
  };
}

module.exports = { parse7tvSet, parseBttvList, parseBttvChannel, parseFfz, loadEmotes };
