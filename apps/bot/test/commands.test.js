const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleCommand } = require('../src/commands');

test('!ping returns pong! by default', async () => {
  assert.equal(await handleCommand('!ping'), 'pong!');
});

test('!ping returns custom response when configured', async () => {
  assert.equal(
    await handleCommand('!ping', { commandConfigs: { ping: { enabled: true, response: 'alive!' } } }),
    'alive!'
  );
});

test('!ping disabled returns null', async () => {
  assert.equal(
    await handleCommand('!ping', { commandConfigs: { ping: { enabled: false, response: null } } }),
    null
  );
});

test('!song disabled returns null', async () => {
  assert.equal(
    await handleCommand('!song', { commandConfigs: { song: { enabled: false, response: null } } }),
    null
  );
});

test('!song without lastfmUsername returns config message', async () => {
  assert.equal(
    await handleCommand('!song'),
    'No Last.fm username configured for this channel.'
  );
});

test('!uptime returns null when no broadcasterId', async () => {
  assert.equal(await handleCommand('!uptime'), null);
});

test('!uptime disabled returns null', async () => {
  assert.equal(
    await handleCommand('!uptime', { broadcasterId: '123', commandConfigs: { uptime: { enabled: false, response: null } } }),
    null
  );
});

test('unknown command returns null', async () => {
  assert.equal(await handleCommand('hello world'), null);
});

test('handles extra whitespace around !ping', async () => {
  assert.equal(await handleCommand('  !ping  '), 'pong!');
});

test('empty message returns null', async () => {
  assert.equal(await handleCommand(''), null);
});

const { hasRole } = require('../src/commands');

test('hasRole: everyone tier always passes', () => {
  assert.equal(hasRole({}, 'everyone'), true);
});

test('hasRole: subscriber tier rejects a plain viewer', () => {
  assert.equal(hasRole({ isSubscriber: false, isVip: false, isModerator: false, isBroadcaster: false }, 'subscriber'), false);
});

test('hasRole: subscriber tier accepts a subscriber', () => {
  assert.equal(hasRole({ isSubscriber: true, isVip: false, isModerator: false, isBroadcaster: false }, 'subscriber'), true);
});

test('hasRole: vip tier rejects a subscriber who is not vip', () => {
  assert.equal(hasRole({ isSubscriber: true, isVip: false, isModerator: false, isBroadcaster: false }, 'vip'), false);
});

test('hasRole: moderator tier accepts a moderator', () => {
  assert.equal(hasRole({ isSubscriber: false, isVip: false, isModerator: true, isBroadcaster: false }, 'moderator'), true);
});

test('hasRole: moderator tier accepts the broadcaster even without isModerator set', () => {
  assert.equal(hasRole({ isSubscriber: false, isVip: false, isModerator: false, isBroadcaster: true }, 'moderator'), true);
});

test('hasRole: broadcaster tier rejects a moderator who is not the broadcaster', () => {
  assert.equal(hasRole({ isSubscriber: false, isVip: false, isModerator: true, isBroadcaster: false }, 'broadcaster'), false);
});

test('!ping gated to moderator blocks a plain viewer', async () => {
  assert.equal(
    await handleCommand('!ping', { commandConfigs: { ping: { enabled: true, response: 'pong!', min_role: 'moderator' } } }),
    null
  );
});

test('!ping gated to moderator allows a moderator', async () => {
  assert.equal(
    await handleCommand('!ping', {
      commandConfigs: { ping: { enabled: true, response: 'pong!', min_role: 'moderator' } },
      isModerator: true,
    }),
    'pong!'
  );
});

test('!ping gated to moderator allows the broadcaster without isModerator set', async () => {
  assert.equal(
    await handleCommand('!ping', {
      commandConfigs: { ping: { enabled: true, response: 'pong!', min_role: 'moderator' } },
      isBroadcaster: true,
    }),
    'pong!'
  );
});

test('custom command gated to subscriber blocks a plain viewer', async () => {
  assert.equal(
    await handleCommand('!hug', { commandConfigs: { hug: { enabled: true, response: 'hugs!', min_role: 'subscriber' } } }),
    null
  );
});

test('custom command gated to subscriber allows a subscriber', async () => {
  assert.equal(
    await handleCommand('!hug', {
      commandConfigs: { hug: { enabled: true, response: 'hugs!', min_role: 'subscriber' } },
      isSubscriber: true,
    }),
    'hugs!'
  );
});

test('command with no configured min_role defaults to everyone (unchanged behavior)', async () => {
  assert.equal(await handleCommand('!ping'), 'pong!');
});
