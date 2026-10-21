const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, getCallerId, createChannel } = require('./helpers');

const skip = process.env.DATABASE_URL ? false : 'DATABASE_URL not set';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('overlay routes', { skip }, () => {
  const prefix = `t${crypto.randomBytes(4).toString('hex')}`;
  let pool, app, main;
  const u = {};

  const call = (path, { user, method = 'GET', body } = {}) => fetch(app.base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const create = async (user, kind, name) => {
    const res = await call('/overlay-config', { user, method: 'POST', body: name === undefined ? { kind } : { kind, name } });
    assert.equal(res.status, 201, `create ${kind}`);
    return res.json();
  };
  const get = async (user, id) => (await call(`/overlay-config/${id}`, { user })).json();
  const put = (user, id, body) => call(`/overlay-config/${id}`, { user, method: 'PUT', body });
  const list = async (user) => (await call('/overlay-config', { user })).json();

  before(async () => {
    pool = require('../src/db');
    await require('../src/migrate').migrate();
    for (const name of ['alice', 'bob', 'carol', 'dana', 'erin', 'frank', 'gina']) {
      u[name] = await createChannel(prefix, name, name === 'alice' ? 'alice_fm' : null);
    }
    u.ghost = `${prefix}-ghost`; // signed in, but the bot was never invited
    app = await startApp(require('../src/routes/overlayConfig')({ pool, getCallerId }));
    main = await create(u.alice, 'chat', 'Main chat');
  });

  after(async () => {
    await app.close();
    await pool.query('DELETE FROM channels WHERE twitch_user_id LIKE $1', [`${prefix}-%`]);
    await pool.end();
  });

  test('every route needs a signed-in caller', async () => {
    const id = crypto.randomUUID();
    const routes = [
      ['GET', '/overlay-config'], ['POST', '/overlay-config'],
      ['GET', `/overlay-config/${id}`], ['PUT', `/overlay-config/${id}`], ['DELETE', `/overlay-config/${id}`],
      ['POST', `/overlay-config/${id}/duplicate`], ['POST', `/overlay-config/${id}/token/rotate`],
    ];
    for (const [method, path] of routes) {
      const res = await call(path, { method, body: method === 'GET' || method === 'DELETE' ? undefined : {} });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });

  test('malformed and unknown ids are 404 on every route', async () => {
    for (const id of ['not-a-uuid', '..%2F..%2Fx', crypto.randomUUID()]) {
      assert.equal((await call(`/overlay-config/${id}`, { user: u.alice })).status, 404, id);
      assert.equal((await put(u.alice, id, { name: 'x' })).status, 404, id);
      assert.equal((await call(`/overlay-config/${id}`, { user: u.alice, method: 'DELETE' })).status, 404, id);
      assert.equal((await call(`/overlay-config/${id}/duplicate`, { user: u.alice, method: 'POST' })).status, 404, id);
      assert.equal((await call(`/overlay-config/${id}/token/rotate`, { user: u.alice, method: 'POST' })).status, 404, id);
    }
  });

  test('the list starts empty, even for a caller who has not invited the bot', async () => {
    assert.deepEqual(await list(u.dana), []);
    assert.deepEqual(await list(u.ghost), []);
  });

  test('creating needs an invited bot and a valid kind', async () => {
    const res = await call('/overlay-config', { user: u.ghost, method: 'POST', body: { kind: 'chat' } });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Invite the bot/);
    for (const body of [{}, { kind: 'alerts' }, { kind: 5 }, { kind: '__proto__' }, { kind: null }]) {
      const bad = await call('/overlay-config', { user: u.alice, method: 'POST', body });
      assert.equal(bad.status, 400, JSON.stringify(body));
    }
  });

  test('new overlays get counting default names, with separate ids and tokens', async () => {
    const a = await create(u.erin, 'chat');
    const b = await create(u.erin, 'chat');
    const c = await create(u.erin, 'nowplaying');
    assert.match(a.id, UUID_RE);
    assert.equal(a.kind, 'chat');
    assert.equal(a.description, '');
    assert.match(a.token, /^[A-Za-z0-9_-]{32}$/);
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.token, b.token);
    const names = (await list(u.erin)).map(o => o.name);
    assert.deepEqual(names, ['Chat overlay', 'Chat overlay 2', 'Now Playing']);
    assert.equal(c.name, 'Now Playing');
    assert.ok((await list(u.erin)).every(o => typeof o.updated_at === 'string' && o.token));
  });

  test('names are cleaned, and an empty name is rejected', async () => {
    const cleaned = await create(u.bob, 'chat', '  Stage \n chat  ');
    assert.equal(cleaned.name, 'Stage chat');
    const long = await create(u.bob, 'chat', 'a'.repeat(100));
    assert.equal(long.name.length, 60);
    for (const name of ['', '   ', 5, null]) {
      const res = await call('/overlay-config', { user: u.bob, method: 'POST', body: { kind: 'chat', name } });
      assert.equal(res.status, 400, String(name));
    }
  });

  test('GET returns one overlay with defaults, its token and the schema', async () => {
    const got = await get(u.alice, main.id);
    assert.equal(got.id, main.id);
    assert.equal(got.kind, 'chat');
    assert.equal(got.name, 'Main chat');
    assert.equal(got.description, '');
    assert.equal(got.token, main.token);
    assert.equal(got.config.fontSize, 22);
    assert.ok(Array.isArray(got.schema.sections) && got.schema.sections.length > 0);
  });

  test('PUT sanitizes hostile settings and persists only schema keys', async () => {
    const res = await put(u.alice, main.id, {
      config: { fontSize: 9999, entrance: 'spin', evil: 1, customCss: 'a{}</style>', textShadow: 'yes' },
    });
    assert.equal(res.status, 200);
    const saved = await res.json();
    assert.equal(saved.config.fontSize, 96);
    assert.equal(saved.config.entrance, 'slide');
    assert.equal(saved.config.textShadow, true);
    assert.equal(saved.config.customCss, 'a{}>');
    assert.equal('evil' in saved.config, false);
    assert.deepEqual((await get(u.alice, main.id)).config, saved.config);
    const { rows } = await pool.query('SELECT config FROM overlays WHERE id = $1', [main.id]);
    assert.equal('evil' in rows[0].config, false);
  });

  test('PUT can rename, describe and reset, each on its own', async () => {
    await put(u.alice, main.id, { config: { fontSize: 30 } });

    let saved = await (await put(u.alice, main.id, { name: '  Renamed  ' })).json();
    assert.equal(saved.name, 'Renamed');
    assert.equal(saved.config.fontSize, 30, 'renaming leaves the settings alone');

    saved = await (await put(u.alice, main.id, { description: ' new\n description ' })).json();
    assert.equal(saved.description, 'new description');
    assert.equal(saved.name, 'Renamed');

    saved = await (await put(u.alice, main.id, { config: {} })).json();
    assert.equal(saved.config.fontSize, 22, 'an empty config resets to defaults');
    assert.equal(saved.name, 'Renamed');

    saved = await (await put(u.alice, main.id, { name: 'Main chat', description: 'D', config: { fontSize: 40 } })).json();
    assert.deepEqual([saved.name, saved.description, saved.config.fontSize], ['Main chat', 'D', 40]);
  });

  test('PUT rejects bodies it cannot use and changes nothing', async () => {
    const snapshot = await get(u.alice, main.id);
    const bad = [
      {}, { other: 1 }, { config: [] }, { config: 'x' }, { config: null }, { config: 5 },
      { name: '' }, { name: '   ' }, { name: 5 }, { name: null }, { description: 5 }, { description: null },
    ];
    for (const body of bad) {
      assert.equal((await put(u.alice, main.id, body)).status, 400, JSON.stringify(body));
    }
    assert.deepEqual(await get(u.alice, main.id), snapshot);
  });

  test('two overlays of the same kind keep separate settings and tokens', async () => {
    const a = await create(u.alice, 'nowplaying', 'Card A');
    const b = await create(u.alice, 'nowplaying', 'Card B');
    await put(u.alice, a.id, { config: { popupSeconds: 33 } });
    assert.equal((await get(u.alice, a.id)).config.popupSeconds, 33);
    assert.equal((await get(u.alice, b.id)).config.popupSeconds, 10);
    assert.notEqual(a.token, b.token);
    const pubA = await (await call(`/overlay-config/public/${a.token}`)).json();
    const pubB = await (await call(`/overlay-config/public/${b.token}`)).json();
    assert.equal(pubA.config.popupSeconds, 33);
    assert.equal(pubB.config.popupSeconds, 10);
  });

  test('other users cannot see or touch an overlay', async () => {
    const mine = await create(u.alice, 'chat', 'Private');
    const attempts = [
      ['GET', `/overlay-config/${mine.id}`, undefined],
      ['PUT', `/overlay-config/${mine.id}`, { name: 'hacked' }],
      ['DELETE', `/overlay-config/${mine.id}`, undefined],
      ['POST', `/overlay-config/${mine.id}/duplicate`, {}],
      ['POST', `/overlay-config/${mine.id}/token/rotate`, {}],
    ];
    for (const [method, path, body] of attempts) {
      assert.equal((await call(path, { user: u.gina, method, body })).status, 404, `${method} ${path}`);
    }
    assert.ok(!(await list(u.gina)).some(o => o.id === mine.id));
    const still = await get(u.alice, mine.id);
    assert.equal(still.name, 'Private');
    assert.equal(still.token, mine.token);
  });

  test('duplicate copies settings and description under a new name, id and token', async () => {
    const src = await create(u.frank, 'chat', 'Stage');
    await put(u.frank, src.id, { description: 'for the main scene', config: { fontSize: 40 } });

    const first = await (await call(`/overlay-config/${src.id}/duplicate`, { user: u.frank, method: 'POST' })).json();
    const second = await (await call(`/overlay-config/${src.id}/duplicate`, { user: u.frank, method: 'POST' })).json();
    assert.equal(first.name, 'Stage copy');
    assert.equal(second.name, 'Stage copy 2');
    assert.equal(first.kind, 'chat');
    assert.equal(first.description, 'for the main scene');
    assert.match(first.id, UUID_RE);
    assert.notEqual(first.id, src.id);
    assert.notEqual(first.token, src.token);
    assert.notEqual(first.token, second.token);
    assert.equal((await get(u.frank, first.id)).config.fontSize, 40);

    await put(u.frank, first.id, { config: { fontSize: 12 } });
    assert.equal((await get(u.frank, src.id)).config.fontSize, 40, 'changing the copy leaves the original alone');
    assert.deepEqual((await list(u.frank)).map(o => o.name), ['Stage', 'Stage copy', 'Stage copy 2']);
  });

  test('a channel can have 20 overlays, for create and duplicate alike', async () => {
    let one;
    for (let i = 0; i < 20; i++) one = await create(u.carol, i % 2 ? 'chat' : 'nowplaying');
    const over = await call('/overlay-config', { user: u.carol, method: 'POST', body: { kind: 'chat' } });
    assert.equal(over.status, 400);
    assert.match((await over.json()).error, /20 overlays/);
    const dup = await call(`/overlay-config/${one.id}/duplicate`, { user: u.carol, method: 'POST' });
    assert.equal(dup.status, 400);
    assert.equal((await list(u.carol)).length, 20);

    assert.equal((await call(`/overlay-config/${one.id}`, { user: u.carol, method: 'DELETE' })).status, 204);
    assert.equal((await call('/overlay-config', { user: u.carol, method: 'POST', body: { kind: 'chat' } })).status, 201);
  });

  test('delete removes the overlay and its URL', async () => {
    const o = await create(u.dana, 'chat', 'Short lived');
    assert.equal((await call(`/overlay-config/public/${o.token}`)).status, 200);
    assert.equal((await call(`/overlay-config/${o.id}`, { user: u.dana, method: 'DELETE' })).status, 204);
    assert.equal((await call(`/overlay-config/${o.id}`, { user: u.dana })).status, 404);
    assert.equal((await call(`/overlay-config/public/${o.token}`)).status, 404);
    assert.ok(!(await list(u.dana)).some(x => x.id === o.id));
    assert.equal((await call(`/overlay-config/${o.id}`, { user: u.dana, method: 'DELETE' })).status, 404);
  });

  test('rotating one overlay’s token leaves the others alone', async () => {
    const a = await create(u.dana, 'chat', 'Rotate A');
    const b = await create(u.dana, 'chat', 'Rotate B');
    const rotated = await (await call(`/overlay-config/${a.id}/token/rotate`, { user: u.dana, method: 'POST' })).json();
    assert.match(rotated.token, /^[A-Za-z0-9_-]{32}$/);
    assert.notEqual(rotated.token, a.token);
    assert.equal((await call(`/overlay-config/public/${a.token}`)).status, 404);
    assert.equal((await call(`/overlay-config/public/${rotated.token}`)).status, 200);
    assert.equal((await call(`/overlay-config/public/${b.token}`)).status, 200);
    assert.equal((await get(u.dana, a.id)).token, rotated.token);
  });

  test('public endpoint returns config plus channel, and the Last.fm user only for Now Playing', async () => {
    const np = await create(u.alice, 'nowplaying', 'Public card');
    const pubChat = await (await call(`/overlay-config/public/${main.token}`)).json();
    assert.equal(pubChat.kind, 'chat');
    assert.equal(pubChat.channel, 'alice');
    assert.equal(pubChat.lastfm_username, null);
    assert.equal(typeof pubChat.config.fontSize, 'number');
    const res = await call(`/overlay-config/public/${np.token}`);
    const pubNp = await res.json();
    assert.equal(pubNp.kind, 'nowplaying');
    assert.equal(pubNp.lastfm_username, 'alice_fm');
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  test('public endpoint 404s for malformed and unknown tokens', async () => {
    const malformed = ['short', 'a'.repeat(65), 'has space!!!!!!!!!!!!!!!!!!!!', '..%2F..%2Fetc', '%00%00%00%00%00%00%00%00%00%00%00%00'];
    for (const token of malformed) {
      assert.equal((await call(`/overlay-config/public/${token}`)).status, 404, token);
    }
    const unknown = crypto.randomBytes(24).toString('base64url');
    assert.equal((await call(`/overlay-config/public/${unknown}`)).status, 404);
  });
  test('thirty simultaneous creates stop at the 20 overlay cap', async () => {
    const racer = await createChannel(prefix, 'racer');
    const results = await Promise.all(Array.from({ length: 30 }, () =>
      call('/overlay-config', { user: racer, method: 'POST', body: { kind: 'chat' } })));
    const statuses = results.map(r => r.status);
    assert.equal(statuses.filter(s => s === 201).length, 20);
    assert.equal(statuses.filter(s => s === 400).length, 10);
    assert.equal((await list(racer)).length, 20);
  });
});
