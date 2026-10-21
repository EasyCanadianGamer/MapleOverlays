const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, getCallerId, createChannel } = require('./helpers');

const skip = process.env.DATABASE_URL ? false : 'DATABASE_URL not set';
const woff2 = (n = 64) => Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(n, 7)]);

describe('overlay font routes', { skip }, () => {
  const prefix = `t${crypto.randomBytes(4).toString('hex')}`;
  let pool, app, alice, bob, carol;

  const upload = (user, body, query = '') => fetch(`${app.base}/overlay-fonts${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...(user ? { 'x-test-user': user } : {}) },
    body,
  });
  const call = (path, { user, method = 'GET', body } = {}) => fetch(app.base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  before(async () => {
    pool = require('../src/db');
    await require('../src/migrate').migrate();
    alice = await createChannel(prefix, 'alice');
    bob = await createChannel(prefix, 'bob');
    carol = await createChannel(prefix, 'carol');
    const overlays = require('../src/routes/overlayConfig')({ pool, getCallerId });
    const fonts = require('../src/routes/overlayFonts')({ pool, getCallerId });
    app = await startApp(overlays, fonts);
  });

  after(async () => {
    await app.close();
    await pool.query('DELETE FROM channels WHERE twitch_user_id LIKE $1', [`${prefix}-%`]);
    await pool.end();
  });

  test('401 without a caller', async () => {
    assert.equal((await upload(null, woff2())).status, 401);
    assert.equal((await call('/overlay-fonts')).status, 401);
    assert.equal((await call(`/overlay-fonts/${crypto.randomUUID()}`, { method: 'DELETE' })).status, 401);
  });

  test('uploads a valid font, lists it, and serves the exact bytes publicly', async () => {
    const bytes = woff2(200);
    const res = await upload(alice, bytes, '?family=My%20Font&filename=ignored.ttf');
    assert.equal(res.status, 201);
    const font = await res.json();
    assert.match(font.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(font.family, 'My Font');
    assert.equal(font.format, 'woff2');
    assert.equal(font.size_bytes, bytes.length);

    const list = await (await call('/overlay-fonts', { user: alice })).json();
    assert.ok(list.some(f => f.id === font.id));
    assert.equal(list.find(f => f.id === font.id).data, undefined, 'the list never includes file bytes');

    const file = await fetch(`${app.base}/overlay-fonts/file/${font.id}`);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'font/woff2');
    assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
    assert.match(file.headers.get('cache-control'), /immutable/);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  });

  test('rejects files that are not fonts and stores nothing', async () => {
    const before = (await (await call('/overlay-fonts', { user: bob })).json()).length;
    const html = Buffer.from('<!doctype html><script>alert(1)</script>');
    const res = await upload(bob, html, '?filename=evil.ttf');
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /woff2, woff, ttf or otf/);
    assert.equal((await upload(bob, Buffer.alloc(0))).status, 400);
    const after = (await (await call('/overlay-fonts', { user: bob })).json()).length;
    assert.equal(after, before);
  });

  test('rejects files over 2 MB with a JSON 413', async () => {
    const big = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(2 * 1024 * 1024, 1)]);
    const res = await upload(bob, big);
    assert.equal(res.status, 413);
    assert.match((await res.json()).error, /2 MB/);
  });

  test('allows 10 fonts per channel and rejects the 11th', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await upload(carol, woff2(20 + i), `?family=F${i}`);
      assert.equal(res.status, 201, `upload ${i}`);
    }
    const res = await upload(carol, woff2(99));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /limit/i);
  });

  test('400 when the uploader has not invited the bot', async () => {
    const res = await upload(`${prefix}-ghost`, woff2());
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Invite the bot/);
  });

  test('file route 404s for unknown and malformed ids', async () => {
    assert.equal((await fetch(`${app.base}/overlay-fonts/file/${crypto.randomUUID()}`)).status, 404);
    assert.equal((await fetch(`${app.base}/overlay-fonts/file/not-a-uuid`)).status, 404);
    assert.equal((await fetch(`${app.base}/overlay-fonts/file/..%2F..%2Fx`)).status, 404);
  });

  test('a user cannot delete someone else’s font', async () => {
    const font = await (await upload(alice, woff2(30), '?family=Mine')).json();
    const res = await call(`/overlay-fonts/${font.id}`, { user: bob, method: 'DELETE' });
    assert.equal(res.status, 404);
    assert.equal((await fetch(`${app.base}/overlay-fonts/file/${font.id}`)).status, 200);
  });

  test('deleting a font that an overlay uses is blocked, and the message names the overlay', async () => {
    const font = await (await upload(alice, woff2(40), '?family=InUse')).json();
    const created = await (await call('/overlay-config', {
      user: alice, method: 'POST', body: { kind: 'nowplaying', name: 'Stage card' },
    })).json();
    await call(`/overlay-config/${created.id}`, {
      user: alice, method: 'PUT', body: { config: { font: `upload:${font.id}` } },
    });

    const blocked = await call(`/overlay-fonts/${font.id}`, { user: alice, method: 'DELETE' });
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).error, /Stage card/);

    await call(`/overlay-config/${created.id}`, { user: alice, method: 'PUT', body: { config: {} } });
    const ok = await call(`/overlay-fonts/${font.id}`, { user: alice, method: 'DELETE' });
    assert.equal(ok.status, 204);
    assert.equal((await fetch(`${app.base}/overlay-fonts/file/${font.id}`)).status, 404);
  });
  test('fifteen simultaneous uploads stop at the 10 font cap', async () => {
    const racer = await createChannel(prefix, 'racer');
    const results = await Promise.all(Array.from({ length: 15 }, (_, i) => upload(racer, woff2(30 + i), `?family=R${i}`)));
    const statuses = results.map(r => r.status);
    assert.equal(statuses.filter(s => s === 201).length, 10);
    assert.equal(statuses.filter(s => s === 400).length, 5);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM overlay_fonts WHERE twitch_user_id = $1', [racer]);
    assert.equal(rows[0].n, 10);
  });
  test('the font list says which overlays use each font', async () => {
    const dana = await createChannel(prefix, 'dana');
    const used = await (await upload(dana, woff2(50), '?family=Used')).json();
    const spare = await (await upload(dana, woff2(51), '?family=Spare')).json();
    const created = await (await call('/overlay-config', {
      user: dana, method: 'POST', body: { kind: 'chat', name: 'Main chat' },
    })).json();
    await call(`/overlay-config/${created.id}`, { user: dana, method: 'PUT', body: { config: { font: `upload:${used.id}` } } });

    const list = await (await call('/overlay-fonts', { user: dana })).json();
    assert.deepEqual(list.find(f => f.id === used.id).used_by, [{ id: created.id, name: 'Main chat' }]);
    assert.deepEqual(list.find(f => f.id === spare.id).used_by, []);
  });
});
