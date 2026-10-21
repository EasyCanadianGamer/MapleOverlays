const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/lib/rateLimit');

function run(limiter, ip) {
  const res = { headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  let passed = false;
  limiter({ ip }, res, () => { passed = true; });
  return { passed, res };
}

describe('createRateLimiter', () => {
  test('counts each client separately and resets after the window', () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
    assert.ok(run(limiter, 'a').passed);
    assert.ok(run(limiter, 'a').passed);
    const blocked = run(limiter, 'a');
    assert.equal(blocked.passed, false);
    assert.equal(blocked.res.code, 429);
    assert.equal(blocked.res.headers['Retry-After'], '1');
    assert.ok(run(limiter, 'b').passed, 'another client is unaffected');
    t = 1001;
    assert.ok(run(limiter, 'a').passed);
  });

  test('drops the oldest clients past maxClients so memory stays bounded', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxClients: 2, now: () => 0 });
    run(limiter, 'a'); run(limiter, 'b'); run(limiter, 'c');
    assert.ok(run(limiter, 'a').passed, 'a was evicted, so it starts fresh');
  });
});
