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
