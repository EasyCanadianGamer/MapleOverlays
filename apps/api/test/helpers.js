const express = require('express');

// Starts an express app with the given routers on an ephemeral port.
async function startApp(...routers) {
  const app = express();
  app.use(express.json());
  for (const r of routers) app.use(r);
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

// Test auth: the caller is whoever the x-test-user header names.
async function getCallerId(req) {
  return req.headers['x-test-user'] ?? null;
}

async function createChannel(prefix, login, lastfm = null) {
  const pool = require('../src/db');
  const id = `${prefix}-${login}`;
  await pool.query(
    `INSERT INTO channels (twitch_user_id, twitch_login, access_token, lastfm_username)
     VALUES ($1, $2, 'x', $3)
     ON CONFLICT (twitch_user_id) DO UPDATE SET lastfm_username = EXCLUDED.lastfm_username`,
    [id, login, lastfm]
  );
  return id;
}

module.exports = { startApp, getCallerId, createChannel };
