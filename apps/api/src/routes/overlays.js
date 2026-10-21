const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getCallerTwitchId } = require('../lib/twitchAuth');

const MAX_CUSTOM_OVERLAYS = 20;
const MAX_NAME_LEN = 100;

router.get('/custom-overlays', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows } = await pool.query(
      'SELECT id, name, updated_at FROM custom_overlays WHERE twitch_user_id = $1 ORDER BY id',
      [callerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /custom-overlays error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/custom-overlays', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows: channelRows } = await pool.query(
      'SELECT twitch_user_id FROM channels WHERE twitch_user_id = $1',
      [callerId]
    );
    if (!channelRows.length) {
      return res.status(400).json({ error: 'Invite the bot to your channel before creating overlays' });
    }
    const { rows: existing } = await pool.query(
      'SELECT COUNT(*) FROM custom_overlays WHERE twitch_user_id = $1',
      [callerId]
    );
    if (Number(existing[0].count) >= MAX_CUSTOM_OVERLAYS) {
      return res.status(400).json({ error: `Maximum ${MAX_CUSTOM_OVERLAYS} custom overlays allowed` });
    }
    const { rows } = await pool.query(
      `INSERT INTO custom_overlays (twitch_user_id, name, widgets)
       VALUES ($1, $2, '[]') RETURNING id, name, widgets, updated_at`,
      [callerId, 'New overlay']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /custom-overlays error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public — no auth. Returns render data for the OBS browser source.
router.get('/custom-overlays/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid overlay id' });
  try {
    const { rows } = await pool.query(
      'SELECT id, name, widgets FROM custom_overlays WHERE id = $1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Overlay not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /custom-overlays/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/custom-overlays/:id', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid overlay id' });

  const { name, widgets } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_NAME_LEN)) {
    return res.status(400).json({ error: `name must be 1–${MAX_NAME_LEN} characters` });
  }
  if (widgets !== undefined && !Array.isArray(widgets)) {
    return res.status(400).json({ error: 'widgets must be an array' });
  }

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM custom_overlays WHERE id = $1 AND twitch_user_id = $2',
      [id, callerId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Overlay not found' });

    const { rows } = await pool.query(
      `UPDATE custom_overlays SET
         name       = COALESCE($3, name),
         widgets    = COALESCE($4, widgets),
         updated_at = NOW()
       WHERE id = $1 AND twitch_user_id = $2 RETURNING id, name, widgets, updated_at`,
      [id, callerId, name?.trim() ?? null, widgets ? JSON.stringify(widgets) : null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /custom-overlays/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/custom-overlays/:id', async (req, res) => {
  const callerId = await getCallerTwitchId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid overlay id' });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM custom_overlays WHERE id = $1 AND twitch_user_id = $2',
      [id, callerId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Overlay not found' });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /custom-overlays/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
