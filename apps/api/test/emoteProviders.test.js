const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse7tvSet, parseBttvList, parseBttvChannel, parseFfz, loadEmotes } = require('../src/lib/emoteProviders');
const { badgeMap } = require('../src/lib/helix');

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('parse7tvSet reads names and builds image urls, tolerating junk', () => {
  const set = { emotes: [
    { name: 'PogU', data: { host: { url: '//cdn.7tv.app/emote/AAA' } } },
    { name: 'NoHost', data: {} },
    { data: { host: { url: '//cdn.7tv.app/emote/BBB' } } },
    { name: '__proto__', data: { host: { url: '//cdn.7tv.app/emote/CCC' } } },
    null,
  ] };
  const out = parse7tvSet(set);
  assert.deepEqual({ ...out }, { PogU: 'https://cdn.7tv.app/emote/AAA/2x.webp' });
  assert.deepEqual({ ...parse7tvSet(null) }, {});
  assert.deepEqual({ ...parse7tvSet(undefined) }, {});
  assert.deepEqual({ ...parse7tvSet({}) }, {});
});

test('parseBttv reads both list shapes', () => {
  assert.deepEqual({ ...parseBttvList([{ id: 'x1', code: 'monkaS' }, { id: 'x2' }, { code: 'y' }]) }, { monkaS: 'https://cdn.betterttv.net/emote/x1/2x' });
  const channel = { channelEmotes: [{ id: 'c1', code: 'A' }], sharedEmotes: [{ id: 's1', code: 'B' }] };
  assert.deepEqual({ ...parseBttvChannel(channel) }, { A: 'https://cdn.betterttv.net/emote/c1/2x', B: 'https://cdn.betterttv.net/emote/s1/2x' });
  assert.deepEqual({ ...parseBttvChannel(null) }, {});
  assert.deepEqual({ ...parseBttvList('nope') }, {});
});

test('parseFfz walks every set and picks a size', () => {
  const body = { sets: {
    '1': { emoticons: [{ name: 'ZrehplaR', urls: { '1': '//cdn.frankerfacez.com/emote/1/1', '2': '//cdn.frankerfacez.com/emote/1/2' } }] },
    '2': { emoticons: [{ name: 'OnlyOne', urls: { '1': '//cdn.frankerfacez.com/emote/2/1' } }, { name: 'NoUrl', urls: {} }] },
  } };
  assert.deepEqual({ ...parseFfz(body) }, {
    ZrehplaR: 'https://cdn.frankerfacez.com/emote/1/2',
    OnlyOne: 'https://cdn.frankerfacez.com/emote/2/1',
  });
  assert.deepEqual({ ...parseFfz(null) }, {});
  assert.deepEqual({ ...parseFfz({ sets: null }) }, {});
});

test('badgeMap keys badges by set/version', () => {
  const payload = { data: [
    { set_id: 'subscriber', versions: [{ id: '0', image_url_2x: 'https://x/0' }, { id: '12', image_url_2x: 'https://x/12' }] },
    { set_id: 'broken', versions: [{ id: '1' }] },
  ] };
  assert.deepEqual(badgeMap(payload), { 'subscriber/0': 'https://x/0', 'subscriber/12': 'https://x/12' });
  assert.deepEqual(badgeMap(null), {});
});

test('loadEmotes merges global and channel sets, channel overriding', async () => {
  const fetchFn = async (url) => {
    if (url.includes('7tv.io/v3/emote-sets/global')) return json({ emotes: [{ name: 'Same', data: { host: { url: '//c/g' } } }] });
    if (url.includes('7tv.io/v3/users/twitch/')) return json({ emote_set: { emotes: [{ name: 'Same', data: { host: { url: '//c/ch' } } }] } });
    if (url.includes('betterttv.net/3/cached/emotes/global')) return json([{ id: 'g', code: 'GlobalB' }]);
    if (url.includes('betterttv.net/3/cached/users/twitch/')) return json({ channelEmotes: [{ id: 'c', code: 'ChanB' }], sharedEmotes: [] });
    if (url.includes('frankerfacez.com/v1/set/global')) return json({ sets: { 3: { emoticons: [{ name: 'GF', urls: { 1: '//f/g' } }] } } });
    if (url.includes('frankerfacez.com/v1/room/id/')) return json({ sets: { 9: { emoticons: [{ name: 'CF', urls: { 1: '//f/c' } }] } } });
    throw new Error('unexpected ' + url);
  };
  const { emotes, failed } = await loadEmotes('123', { fetchFn });
  assert.equal(emotes.sevenTv.Same, 'https://c/ch/2x.webp');
  assert.deepEqual(Object.keys(emotes.bttv).sort(), ['ChanB', 'GlobalB']);
  assert.deepEqual(Object.keys(emotes.ffz).sort(), ['CF', 'GF']);
  assert.deepEqual(failed, []);
});

test('a provider that errors or throws yields empty emotes for that provider only', async () => {
  const fetchFn = async (url) => {
    if (url.includes('7tv.io')) return json({ emotes: [{ name: 'Ok', data: { host: { url: '//c/o' } } }] });
    if (url.includes('betterttv.net')) return json({}, 500);
    throw new Error('network down');
  };
  const { emotes, failed } = await loadEmotes('123', { fetchFn });
  assert.deepEqual(Object.keys(emotes.sevenTv), ['Ok']);
  assert.deepEqual(emotes.bttv, {});
  assert.deepEqual(emotes.ffz, {});
  assert.deepEqual(failed.sort(), ['bttv', 'ffz']);
});

test('a 404 (no account on that provider) is not a failure', async () => {
  const fetchFn = async (url) => {
    if (url.includes('users/twitch') || url.includes('room/id')) return json({}, 404);
    return json({ emotes: [], sets: {} });
  };
  const { failed } = await loadEmotes('123', { fetchFn });
  assert.deepEqual(failed, []);
});

test('a provider that never answers times out instead of hanging', async () => {
  const hang = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const started = Date.now();
  const { emotes, failed } = await loadEmotes('123', { fetchFn: hang, timeoutMs: 30 });
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(emotes, { sevenTv: {}, bttv: {}, ffz: {} });
  assert.deepEqual(failed.sort(), ['bttv', 'ffz', 'sevenTv']);
});

test('the channel id is url-encoded into provider urls', async () => {
  const seen = [];
  const fetchFn = async (url) => { seen.push(url); return json({}, 404); };
  await loadEmotes('1/../2', { fetchFn });
  assert.ok(seen.every(u => !u.includes('/../')));
});
