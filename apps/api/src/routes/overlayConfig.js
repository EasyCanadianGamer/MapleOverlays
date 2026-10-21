'use strict';

const express = require('express');
const crypto = require('crypto');
const {
  isKind, schemaFor, sanitize, defaultsFor,
  cleanName, cleanDescription, defaultName, copyName, MAX_OVERLAYS,
} = require('../lib/overlaySchema');
const { getCallerTwitchId } = require('../lib/twitchAuth');
const { withUserLock } = require('../lib/userLock');

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NO_CHANNEL = 'Invite the bot to your channel before creating overlays';
const LIMIT_MESSAGE = `You can have up to ${MAX_OVERLAYS} overlays. Delete one first.`;
const SUMMARY_COLUMNS = 'id, kind, name, description, token, updated_at';

const newToken = () => crypto.randomBytes(24).toString('base64url');
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function createRouter({ pool = require('../db'), getCallerId = getCallerTwitchId } = {}) {
  const router = express.Router();

  // Each helper writes its own error response and returns null on failure.
  async function requireCaller(req, res) {
    const callerId = await getCallerId(req);
    if (!callerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    return callerId;
  }

  async function requireOwnedId(req, res) {
    const callerId = await requireCaller(req, res);
    if (!callerId) return null;
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      res.status(404).json({ error: 'Overlay not found' });
      return null;
    }
    return { callerId, id };
  }

  // Inserts an overlay for the caller. Returns the new row's summary, or
  // 'no-channel' (bot never invited) or 'limit' (already at the cap). The cap is
  // checked under a per-user lock so two requests at once cannot both slip under it.
  async function insertOverlay(userId, { kind, description, config, pickName }) {
    return withUserLock(pool, 'overlays', userId, async (db) => {
      const { rows: channel } = await db.query('SELECT 1 FROM channels WHERE twitch_user_id = $1', [userId]);
      if (!channel.length) return 'no-channel';
      const { rows: existing } = await db.query('SELECT name FROM overlays WHERE twitch_user_id = $1', [userId]);
      const { rows } = await db.query(
        `INSERT INTO overlays (id, twitch_user_id, kind, name, description, config, token)
         SELECT $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::jsonb, $7::text
          WHERE (SELECT COUNT(*) FROM overlays WHERE twitch_user_id = $2::text) < $8::int
         RETURNING ${SUMMARY_COLUMNS}`,
        [crypto.randomUUID(), userId, kind, pickName(existing.map(r => r.name)), description,
          JSON.stringify(config), newToken(), MAX_OVERLAYS]
      );
      return rows[0] ?? 'limit';
    });
  }

  function respondInserted(res, result) {
    if (result === 'no-channel') return res.status(400).json({ error: NO_CHANNEL });
    if (result === 'limit') return res.status(400).json({ error: LIMIT_MESSAGE });
    return res.status(201).json(result);
  }

  const fail = (res, label, err) => {
    console.error(`${label} error:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  };

  // Public: the OBS browser source loads this by token.
  router.get('/overlay-config/public/:token', async (req, res) => {
    const { token } = req.params;
    if (!TOKEN_RE.test(token)) return res.status(404).json({ error: 'Overlay not found' });
    try {
      const { rows } = await pool.query(
        `SELECT o.kind, o.config, c.twitch_login, c.lastfm_username
           FROM overlays o
           JOIN channels c ON c.twitch_user_id = o.twitch_user_id
          WHERE o.token = $1`,
        [token]
      );
      if (!rows.length) return res.status(404).json({ error: 'Overlay not found' });
      const row = rows[0];
      res.set('Cache-Control', 'no-store');
      res.json({
        kind: row.kind,
        config: sanitize(row.kind, row.config),
        channel: row.twitch_login,
        lastfm_username: row.kind === 'nowplaying' ? row.lastfm_username : null,
      });
    } catch (err) {
      fail(res, 'GET /overlay-config/public', err);
    }
  });

  router.get('/overlay-config', async (req, res) => {
    const callerId = await requireCaller(req, res);
    if (!callerId) return;
    try {
      const { rows } = await pool.query(
        `SELECT ${SUMMARY_COLUMNS} FROM overlays WHERE twitch_user_id = $1 ORDER BY created_at, name`,
        [callerId]
      );
      res.json(rows);
    } catch (err) {
      fail(res, 'GET /overlay-config', err);
    }
  });

  router.post('/overlay-config', async (req, res) => {
    const callerId = await requireCaller(req, res);
    if (!callerId) return;
    const { kind, name } = req.body ?? {};
    if (!isKind(kind)) return res.status(400).json({ error: 'kind must be "chat" or "nowplaying"' });
    let chosen = null;
    if (name !== undefined) {
      chosen = cleanName(name);
      if (!chosen) return res.status(400).json({ error: 'Name must be 1 to 60 characters' });
    }
    try {
      const result = await insertOverlay(callerId, {
        kind,
        description: '',
        config: defaultsFor(kind),
        pickName: (names) => chosen ?? defaultName(kind, names),
      });
      respondInserted(res, result);
    } catch (err) {
      fail(res, 'POST /overlay-config', err);
    }
  });

  router.post('/overlay-config/:id/duplicate', async (req, res) => {
    const ctx = await requireOwnedId(req, res);
    if (!ctx) return;
    try {
      const { rows } = await pool.query(
        'SELECT kind, name, description, config FROM overlays WHERE id = $1 AND twitch_user_id = $2',
        [ctx.id, ctx.callerId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Overlay not found' });
      const source = rows[0];
      const result = await insertOverlay(ctx.callerId, {
        kind: source.kind,
        description: source.description,
        config: sanitize(source.kind, source.config),
        pickName: (names) => copyName(source.name, names),
      });
      respondInserted(res, result);
    } catch (err) {
      fail(res, 'POST /overlay-config duplicate', err);
    }
  });

  router.get('/overlay-config/:id', async (req, res) => {
    const ctx = await requireOwnedId(req, res);
    if (!ctx) return;
    try {
      const { rows } = await pool.query(
        'SELECT id, kind, name, description, config, token FROM overlays WHERE id = $1 AND twitch_user_id = $2',
        [ctx.id, ctx.callerId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Overlay not found' });
      const row = rows[0];
      res.json({ ...row, config: sanitize(row.kind, row.config), schema: schemaFor(row.kind) });
    } catch (err) {
      fail(res, 'GET /overlay-config/:id', err);
    }
  });

  router.put('/overlay-config/:id', async (req, res) => {
    const ctx = await requireOwnedId(req, res);
    if (!ctx) return;
    const { name, description, config } = req.body ?? {};
    if (name === undefined && description === undefined && config === undefined) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    let cleanedName = null;
    if (name !== undefined) {
      cleanedName = cleanName(name);
      if (!cleanedName) return res.status(400).json({ error: 'Name must be 1 to 60 characters' });
    }
    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'description must be text' });
    }
    if (config !== undefined && !isPlainObject(config)) {
      return res.status(400).json({ error: 'config must be an object' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT kind, name, description, config FROM overlays WHERE id = $1 AND twitch_user_id = $2',
        [ctx.id, ctx.callerId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Overlay not found' });
      const row = rows[0];
      const next = {
        name: cleanedName ?? row.name,
        description: description !== undefined ? cleanDescription(description) : row.description,
        config: sanitize(row.kind, config !== undefined ? config : row.config),
      };
      const { rows: updated } = await pool.query(
        `UPDATE overlays SET name = $3, description = $4, config = $5::jsonb, updated_at = clock_timestamp()
          WHERE id = $1 AND twitch_user_id = $2
          RETURNING id, kind, name, description, config, token`,
        [ctx.id, ctx.callerId, next.name, next.description, JSON.stringify(next.config)]
      );
      // answer with the sanitized object, whose keys keep the schema's order (JSONB reorders them)
      res.json({ ...updated[0], config: next.config });
    } catch (err) {
      fail(res, 'PUT /overlay-config/:id', err);
    }
  });

  router.delete('/overlay-config/:id', async (req, res) => {
    const ctx = await requireOwnedId(req, res);
    if (!ctx) return;
    try {
      const { rowCount } = await pool.query('DELETE FROM overlays WHERE id = $1 AND twitch_user_id = $2', [ctx.id, ctx.callerId]);
      if (!rowCount) return res.status(404).json({ error: 'Overlay not found' });
      res.status(204).end();
    } catch (err) {
      fail(res, 'DELETE /overlay-config/:id', err);
    }
  });

  router.post('/overlay-config/:id/token/rotate', async (req, res) => {
    const ctx = await requireOwnedId(req, res);
    if (!ctx) return;
    try {
      const { rows } = await pool.query(
        `UPDATE overlays SET token = $3, updated_at = clock_timestamp()
          WHERE id = $1 AND twitch_user_id = $2 RETURNING token`,
        [ctx.id, ctx.callerId, newToken()]
      );
      if (!rows.length) return res.status(404).json({ error: 'Overlay not found' });
      res.json({ token: rows[0].token });
    } catch (err) {
      fail(res, 'POST /overlay-config rotate', err);
    }
  });

  return router;
}

module.exports = createRouter;
