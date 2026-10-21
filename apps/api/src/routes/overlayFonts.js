'use strict';

const express = require('express');
const crypto = require('crypto');
const { withUserLock } = require('../lib/userLock');
const { MAX_FONT_BYTES, MAX_FONTS_PER_CHANNEL, MIME, detectFontFormat, cleanFamily } = require('../lib/fontFormat');
const { getCallerTwitchId } = require('../lib/twitchAuth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NO_CHANNEL = 'Invite the bot to your channel before uploading fonts';

function createRouter({ pool = require('../db'), getCallerId = getCallerTwitchId } = {}) {
  const router = express.Router();

  // Auth runs before the body parser so an anonymous caller cannot make the server read 2 MB.
  const requireCaller = async (req, res, next) => {
    const callerId = await getCallerId(req);
    if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
    req.callerId = callerId;
    next();
  };
  const rawFont = express.raw({ type: () => true, limit: MAX_FONT_BYTES });

  router.get('/overlay-fonts', requireCaller, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, family, format, size_bytes FROM overlay_fonts WHERE twitch_user_id = $1 ORDER BY created_at',
        [req.callerId]
      );
      const { rows: overlays } = await pool.query(
        'SELECT id, name, config::text AS config FROM overlays WHERE twitch_user_id = $1 ORDER BY created_at',
        [req.callerId]
      );
      // Same match the delete check uses, so the list and the 409 always agree.
      for (const font of rows) {
        font.used_by = overlays.filter(o => o.config.includes(`upload:${font.id}`)).map(o => ({ id: o.id, name: o.name }));
      }
      res.json(rows);
    } catch (err) {
      console.error('GET /overlay-fonts error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/overlay-fonts', requireCaller, rawFont, async (req, res) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: 'Empty upload' });
    }
    const format = detectFontFormat(body);
    if (!format) {
      return res.status(400).json({ error: 'Unsupported file. Upload a woff2, woff, ttf or otf font.' });
    }
    try {
      // The cap is checked under a per-user lock so simultaneous uploads cannot all slip under it.
      const rows = await withUserLock(pool, 'fonts', req.callerId, async (db) => (await db.query(
        `INSERT INTO overlay_fonts (id, twitch_user_id, family, format, data, size_bytes)
         SELECT $1::uuid, $2::text, $3::text, $4::text, $5::bytea, $6::int
          WHERE (SELECT COUNT(*) FROM overlay_fonts WHERE twitch_user_id = $2::text) < $7::int
         RETURNING id, family, format, size_bytes`,
        [crypto.randomUUID(), req.callerId, cleanFamily(req.query.family, req.query.filename), format, body, body.length, MAX_FONTS_PER_CHANNEL]
      )).rows);
      if (!rows.length) {
        return res.status(400).json({ error: `Font limit reached (${MAX_FONTS_PER_CHANNEL}). Delete one first.` });
      }
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23503') return res.status(400).json({ error: NO_CHANNEL });
      console.error('POST /overlay-fonts error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Public: the OBS page loads the font through @font-face. The id is a random uuid, so fonts cannot be enumerated.
  router.get('/overlay-fonts/file/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Font not found' });
    try {
      const { rows } = await pool.query('SELECT format, data FROM overlay_fonts WHERE id = $1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Font not found' });
      res.set({
        'Content-Type': MIME[rows[0].format],
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      res.send(rows[0].data);
    } catch (err) {
      console.error('GET /overlay-fonts/file error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/overlay-fonts/:id', requireCaller, async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Font not found' });
    try {
      const { rows: owned } = await pool.query(
        'SELECT 1 FROM overlay_fonts WHERE id = $1 AND twitch_user_id = $2',
        [id, req.callerId]
      );
      if (!owned.length) return res.status(404).json({ error: 'Font not found' });

      const { rows: used } = await pool.query(
        `SELECT name FROM overlays
          WHERE twitch_user_id = $1 AND config::text LIKE $2
          ORDER BY created_at LIMIT 1`,
        [req.callerId, `%upload:${id}%`]
      );
      if (used.length) {
        return res.status(409).json({ error: `This font is used by your overlay '${used[0].name}'. Pick another font there first.` });
      }
      await pool.query('DELETE FROM overlay_fonts WHERE id = $1 AND twitch_user_id = $2', [id, req.callerId]);
      res.status(204).end();
    } catch (err) {
      console.error('DELETE /overlay-fonts error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // body-parser reports an oversized upload as an error object; answer in JSON like every other route.
  router.use((err, _req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Font file is too large (2 MB maximum).' });
    }
    next(err);
  });

  return router;
}

module.exports = createRouter;
