'use strict';

// Fixed-window, per-client request limiter. In memory, so each API process counts
// on its own; that is enough to blunt a runaway script on a public endpoint.
function createRateLimiter({ max, windowMs, maxClients = 10_000, now = Date.now }) {
  const clients = new Map(); // key -> { count, resetAt }

  return function rateLimit(req, res, next) {
    const key = req.ip ?? 'unknown';
    const t = now();
    let entry = clients.get(key);
    if (!entry || entry.resetAt <= t) {
      clients.delete(key); // re-insert so Map order stays oldest-first
      if (clients.size >= maxClients) clients.delete(clients.keys().next().value);
      entry = { count: 0, resetAt: t + windowMs };
      clients.set(key, entry);
    }
    if (entry.count >= max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - t) / 1000))));
      return res.status(429).json({ error: 'Too many requests. Slow down.' });
    }
    entry.count++;
    next();
  };
}

module.exports = { createRateLimiter };
