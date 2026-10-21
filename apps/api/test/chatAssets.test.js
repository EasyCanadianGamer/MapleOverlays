const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const createRouter = require('../src/routes/chatAssets');
const { startApp } = require('./helpers');

const EMOTES = { sevenTv: { A: 'https://a' }, bttv: {}, ffz: {} };

function harness(overrides = {}) {
  const calls = { user: 0, badges: 0, emotes: 0 };
  let t = 0;
  const router = createRouter({
    getUserIdByLogin: async () => { calls.user++; return '42'; },
    getBadges: async () => { calls.badges++; return { badges: { 'subscriber/0': 'https://b' }, failed: false }; },
    loadEmotesFn: async () => { calls.emotes++; return { emotes: EMOTES, failed: [] }; },
    now: () => t,
    ...overrides,
  });
  return { router, calls, advance: ms => { t += ms; } };
}

describe('GET /chat-assets/:login', () => {
  test('returns badges and emotes for a channel', async () => {
    const { router } = harness();
    const app = await startApp(router);
    try {
      const res = await fetch(`${app.base}/chat-assets/SomeStreamer`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { badges: { 'subscriber/0': 'https://b' }, emotes: EMOTES });
    } finally { await app.close(); }
  });

  test('caches a good answer for ten minutes', async () => {
    const h = harness();
    const app = await startApp(h.router);
    try {
      await fetch(`${app.base}/chat-assets/streamer`);
      await fetch(`${app.base}/chat-assets/STREAMER`);
      h.advance(61_000);
      await fetch(`${app.base}/chat-assets/streamer`);
      assert.deepEqual(h.calls, { user: 1, badges: 1, emotes: 1 });
      h.advance(10 * 60_000);
      await fetch(`${app.base}/chat-assets/streamer`);
      assert.equal(h.calls.user, 2);
    } finally { await app.close(); }
  });

  test('a partial answer is served but only cached for a minute', async () => {
    const h = harness({ loadEmotesFn: async () => ({ emotes: EMOTES, failed: ['bttv'] }) });
    const app = await startApp(h.router);
    try {
      const res = await fetch(`${app.base}/chat-assets/streamer`);
      assert.equal(res.status, 200);
      h.advance(61_000);
      await fetch(`${app.base}/chat-assets/streamer`);
      assert.equal(h.calls.user, 2);
    } finally { await app.close(); }
  });

  test('rejects invalid logins before doing any work', async () => {
    const h = harness();
    const app = await startApp(h.router);
    try {
      for (const bad of ['a b', 'a'.repeat(26), '..%2Fx', 'bad!name', '%00']) {
        assert.equal((await fetch(`${app.base}/chat-assets/${bad}`)).status, 400, bad);
      }
      assert.equal(h.calls.user, 0);
    } finally { await app.close(); }
  });

  test('404 for an unknown channel without contacting the emote providers', async () => {
    const h = harness({ getUserIdByLogin: async () => null });
    const app = await startApp(h.router);
    try {
      assert.equal((await fetch(`${app.base}/chat-assets/nobody`)).status, 404);
      assert.equal(h.calls.emotes, 0);
    } finally { await app.close(); }
  });

  test('a Helix failure is a 502 and is not cached', async () => {
    let fail = true;
    const h = harness({ getUserIdByLogin: async () => { if (fail) throw new Error('helix down'); return '42'; } });
    const app = await startApp(h.router);
    try {
      assert.equal((await fetch(`${app.base}/chat-assets/streamer`)).status, 502);
      fail = false;
      assert.equal((await fetch(`${app.base}/chat-assets/streamer`)).status, 200);
    } finally { await app.close(); }
  });

  test('the cache is bounded', async () => {
    const h = harness({ maxEntries: 2 });
    const app = await startApp(h.router);
    try {
      for (const login of ['one', 'two', 'three']) await fetch(`${app.base}/chat-assets/${login}`);
      await fetch(`${app.base}/chat-assets/one`);
      assert.equal(h.calls.user, 4, 'the oldest entry was evicted and fetched again');
    } finally { await app.close(); }
  });
  test('answers 429 with Retry-After once a client passes the rate limit, then recovers', async () => {
    const h = harness({ rateLimit: { max: 3, windowMs: 60_000 } });
    const app = await startApp(h.router);
    try {
      for (let i = 0; i < 3; i++) assert.equal((await fetch(`${app.base}/chat-assets/streamer`)).status, 200);
      const blocked = await fetch(`${app.base}/chat-assets/streamer`);
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get('retry-after')) > 0);
      h.advance(60_001);
      assert.equal((await fetch(`${app.base}/chat-assets/streamer`)).status, 200);
    } finally { await app.close(); }
  });
});
