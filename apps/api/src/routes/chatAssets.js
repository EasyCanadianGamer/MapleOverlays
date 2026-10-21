'use strict';

const express = require('express');
const helix = require('../lib/helix');
const { loadEmotes } = require('../lib/emoteProviders');
const { createRateLimiter } = require('../lib/rateLimit');

const LOGIN_RE = /^[A-Za-z0-9_]{1,25}$/;
const OK_TTL_MS = 10 * 60_000;
const SHORT_TTL_MS = 60_000;

function createRouter({
  getUserIdByLogin = helix.getUserIdByLogin,
  getBadges = helix.getBadges,
  loadEmotesFn = loadEmotes,
  now = Date.now,
  maxEntries = 500,
  // Per client IP. An OBS page asks once per load, so this is far above real use.
  rateLimit = { max: 120, windowMs: 60_000 },
} = {}) {
  const router = express.Router();
  const limiter = createRateLimiter({ ...rateLimit, now });
  const cache = new Map(); // login -> { promise, expiresAt }

  async function build(login) {
    const id = await getUserIdByLogin(login);
    if (!id) return { status: 404, ttl: SHORT_TTL_MS };
    const [{ badges, failed: badgesFailed }, { emotes, failed }] = await Promise.all([getBadges(id), loadEmotesFn(id)]);
    const partial = badgesFailed || failed.length > 0;
    return { status: 200, body: { badges, emotes }, ttl: partial ? SHORT_TTL_MS : OK_TTL_MS };
  }

  router.get('/chat-assets/:login', limiter, async (req, res) => {
    if (!LOGIN_RE.test(req.params.login)) return res.status(400).json({ error: 'Invalid channel login' });
    const login = req.params.login.toLowerCase();

    let entry = cache.get(login);
    if (!entry || entry.expiresAt <= now()) {
      // The public endpoint takes any login, so the cache must not grow without bound.
      if (!cache.has(login) && cache.size >= maxEntries) cache.delete(cache.keys().next().value);
      const promise = build(login);
      entry = { promise, expiresAt: Infinity };
      cache.set(login, entry);
      const mine = entry;
      promise.then(
        (r) => { mine.expiresAt = now() + r.ttl; },
        () => { if (cache.get(login) === mine) cache.delete(login); }
      );
    }

    try {
      const result = await entry.promise;
      if (result.status === 404) return res.status(404).json({ error: 'Channel not found' });
      res.set('Cache-Control', 'public, max-age=60');
      res.json(result.body);
    } catch (err) {
      console.error('GET /chat-assets error:', err.message);
      res.status(502).json({ error: 'Failed to load chat assets' });
    }
  });

  return router;
}

module.exports = createRouter;
