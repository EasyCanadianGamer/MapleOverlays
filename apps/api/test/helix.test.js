const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const helix = require('../src/lib/helix');

// A fetch that never answers on its own; it only settles when its abort signal fires.
function hangingFetch(seen) {
  return (url, opts = {}) => new Promise((_, reject) => {
    seen.push(opts.signal);
    if (!opts.signal) return; // no signal: hangs forever, the test's own timer catches it
    opts.signal.addEventListener('abort', () => reject(opts.signal.reason));
  });
}

describe('helix timeouts', () => {
  beforeEach(() => { process.env.TWITCH_CLIENT_ID = 'id'; process.env.TWITCH_CLIENT_SECRET = 's'; });

  test('a hanging Twitch token request is aborted instead of waiting forever', async () => {
    const seen = [];
    const result = await Promise.race([
      helix.getUserIdByLogin('x', hangingFetch(seen), { timeoutMs: 30 }).then(() => 'resolved', (e) => e.name),
      new Promise(r => setTimeout(() => r('still hanging'), 500)),
    ]);
    assert.notEqual(result, 'still hanging');
    assert.notEqual(result, 'resolved');
    assert.ok(seen[0] instanceof AbortSignal);
  });

  test('a hanging badges request is aborted and reported as failed, not thrown', async () => {
    const seen = [];
    const fetchFn = async (url, opts = {}) => {
      if (String(url).includes('oauth2/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) };
      }
      return hangingFetch(seen)(url, opts);
    };
    const out = await Promise.race([
      helix.getBadges('42', fetchFn, { timeoutMs: 30 }),
      new Promise(r => setTimeout(() => r('still hanging'), 500)),
    ]);
    assert.notEqual(out, 'still hanging');
    assert.equal(out.failed, true);
  });
});
