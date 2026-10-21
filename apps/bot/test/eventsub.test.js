process.env.BOT_ACCESS_TOKEN = 'test-token';
process.env.TWITCH_CLIENT_ID = 'test-client-id';
process.env.TWITCH_CLIENT_SECRET = 'test-client-secret';
process.env.BOT_USER_ID = 'test-bot-id';

const { test, mock, after } = require('node:test');
const assert = require('node:assert');
const { WebSocketServer } = require('ws');
const EventSubManager = require('../src/eventsub');

function startFakeTwitchServer() {
  const wss = new WebSocketServer({ port: 0 });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      metadata: { message_type: 'session_welcome' },
      payload: { session: { id: 'session-1', keepalive_timeout_seconds: 10 } },
    }));
  });
  return wss;
}

test('closes the connection when no message arrives within the keepalive timeout', async (t) => {
  const wss = startFakeTwitchServer();
  const port = wss.address().port;
  after(() => wss.close());

  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());

  const manager = new EventSubManager(() => {});
  t.after(() => {
    // Detach before closing so the manager's own reconnect logic doesn't
    // fire during teardown (mirrors the `this.ws === ws` guard in eventsub.js).
    const ws = manager.ws;
    manager.ws = null;
    ws?.close();
  });
  await manager.connect(`ws://localhost:${port}`);

  assert.strictEqual(manager.ws.readyState, manager.ws.OPEN);

  // keepalive_timeout_seconds (10s) + watchdog buffer (5s), with no further
  // messages sent by the fake server — simulates a silently-dead connection.
  mock.timers.tick(15_000);

  // Give the real close handshake a tick to complete against mocked timers.
  await new Promise((resolve) => setImmediate(resolve));

  assert.notStrictEqual(manager.ws.readyState, manager.ws.OPEN);
});
