const pool = require('./db');
const { sendMessage, deleteMessage, timeoutUser } = require('./twitch');
const { handleCommand } = require('./commands');
const EventSubManager = require('./eventsub');
const { decrypt } = require('./crypto');

const configCache = new Map();
const CONFIG_TTL = 60_000;

// channel broadcasterId -> Map<viewerLogin, sessionStartMs>
// Tracks when each viewer first chatted in the current live session
const sessionMap = new Map();

async function getChannelData(broadcasterId) {
  const hit = configCache.get(broadcasterId);
  if (hit && Date.now() - hit.fetchedAt < CONFIG_TTL) return hit;

  const [cfgResult, chanResult] = await Promise.all([
    pool.query('SELECT command, enabled, response FROM command_configs WHERE twitch_user_id = $1', [broadcasterId]),
    pool.query('SELECT lastfm_username, access_token, offline_since, tip_url, automod_settings FROM channels WHERE twitch_user_id = $1', [broadcasterId]),
  ]);

  const commandConfigs = Object.fromEntries(cfgResult.rows.map(r => [r.command, { enabled: r.enabled, response: r.response }]));
  const lastfmUsername = chanResult.rows[0]?.lastfm_username ?? null;
  const rawToken = chanResult.rows[0]?.access_token;
  let accessToken = null;
  if (rawToken) {
    try {
      accessToken = decrypt(rawToken);
    } catch {
      console.error(`Token for channel ${broadcasterId} appears corrupt or unencrypted — channel must re-authorize.`);
    }
  }
  const offlineSince   = chanResult.rows[0]?.offline_since   ?? null;
  const tipUrl         = chanResult.rows[0]?.tip_url         ?? null;
  const automodSettings = chanResult.rows[0]?.automod_settings ?? [true, true, true, false];

  const data = { commandConfigs, lastfmUsername, accessToken, offlineSince, tipUrl, automodSettings, fetchedAt: Date.now() };
  configCache.set(broadcasterId, data);
  return data;
}

async function flushWatchtimes(broadcasterId) {
  const session = sessionMap.get(broadcasterId);
  if (!session || session.size === 0) return;
  const now = Date.now();
  for (const [viewerLogin, startMs] of session) {
    const seconds = Math.floor((now - startMs) / 1000);
    if (seconds < 1) continue;
    await pool.query(
      `INSERT INTO watchtimes (channel_user_id, viewer_login, total_seconds)
       VALUES ($1, $2, $3)
       ON CONFLICT (channel_user_id, viewer_login) DO UPDATE
         SET total_seconds = watchtimes.total_seconds + EXCLUDED.total_seconds`,
      [broadcasterId, viewerLogin, seconds]
    ).catch(err => {
      console.error(`Failed to persist watchtime for ${viewerLogin} in ${broadcasterId}:`, err.message);
    });
  }
  sessionMap.delete(broadcasterId);
}

async function logEvent(channelUserId, eventType, userLogin = null, extraData = null) {
  await pool.query(
    'INSERT INTO channel_events (channel_user_id, event_type, user_login, extra_data) VALUES ($1, $2, $3, $4)',
    [channelUserId, eventType, userLogin, extraData ? JSON.stringify(extraData) : null]
  ).catch(err => console.error('logEvent failed:', err.message));
}

async function enforceAutoMod(broadcasterId, chatterId, chatterLogin, messageText, messageId, isSubscriber, emoteCount, settings) {
  const [filterLinks, capsTax, emoteSpam, firstTimeWarn] = settings;

  if (filterLinks && !isSubscriber && /https?:\/\/|www\./i.test(messageText)) {
    await deleteMessage(broadcasterId, messageId).catch(() => {});
    return true;
  }
  if (capsTax) {
    const alpha = messageText.replace(/[^a-zA-Z]/g, '');
    if (alpha.length >= 10 && messageText.replace(/[^A-Z]/g, '').length / alpha.length > 0.7) {
      await timeoutUser(broadcasterId, chatterId, 30, 'Excessive caps').catch(() => {});
      return true;
    }
  }
  if (emoteSpam && emoteCount > 10) {
    await timeoutUser(broadcasterId, chatterId, 10, 'Emote spam').catch(() => {});
    return true;
  }
  if (firstTimeWarn) {
    const row = await pool.query(
      'SELECT 1 FROM watchtimes WHERE channel_user_id = $1 AND viewer_login = $2',
      [broadcasterId, chatterLogin]
    ).catch(() => ({ rows: [1] }));
    if (!row.rows.length) {
      await sendMessage(broadcasterId, `Welcome to the chat, @${chatterLogin}! 👋`).catch(() => {});
    }
  }
  return false;
}

const manager = new EventSubManager(
  async (broadcasterId, broadcasterLogin, chatterId, chatterLogin, messageText, meta = {}) => {
    // Track watchtime session — record first message time per viewer per session
    if (!sessionMap.has(broadcasterId)) sessionMap.set(broadcasterId, new Map());
    const channelSession = sessionMap.get(broadcasterId);
    if (!channelSession.has(chatterLogin)) channelSession.set(chatterLogin, Date.now());

    const { commandConfigs, lastfmUsername, accessToken, offlineSince, tipUrl, automodSettings } = await getChannelData(broadcasterId)
      .catch((err) => {
        console.error(`Failed to load channel data for ${broadcasterId}:`, err.message);
        return { commandConfigs: {}, lastfmUsername: null, accessToken: null, offlineSince: null, tipUrl: null, automodSettings: [true, true, true, false] };
      });

    const { isSubscriber = false, emoteCount = 0, messageId = '' } = meta;
    const modded = await enforceAutoMod(
      broadcasterId, chatterId, chatterLogin, messageText, messageId,
      isSubscriber, emoteCount, automodSettings
    ).catch(() => false);
    if (modded) return;

    if (!messageText.trim().startsWith('!')) return;

    const sessionStart = channelSession.get(chatterLogin) ?? null;
    const getWatchtime = async () => {
      const { rows } = await pool.query(
        'SELECT total_seconds FROM watchtimes WHERE channel_user_id = $1 AND viewer_login = $2',
        [broadcasterId, chatterLogin]
      );
      const dbSeconds = Number(rows[0]?.total_seconds ?? 0);
      const sessionSeconds = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
      return dbSeconds + sessionSeconds;
    };

    const reply = await handleCommand(messageText, {
      broadcasterId, broadcasterLogin, chatterId, chatterLogin,
      lastfmUsername, commandConfigs, accessToken, offlineSince, tipUrl,
      getWatchtime,
    });
    if (!reply) return;
    try {
      await sendMessage(broadcasterId, reply);
      if (messageText.trim().split(' ')[0] === '!song') {
        pool.query(
          'UPDATE channels SET nowplaying_triggered_at = NOW() WHERE twitch_user_id = $1',
          [broadcasterId]
        ).catch(err => console.error('Failed to set nowplaying_triggered_at:', err.message));
      }
      await logEvent(broadcasterId, 'command', chatterLogin, { command: messageText.split(' ')[0] });
    } catch (err) {
      console.error(`Failed to send message to #${broadcasterLogin}:`, err.message);
    }
  }
);

manager.onStreamState(async (broadcasterId, isLive) => {
  if (isLive) {
    sessionMap.delete(broadcasterId);
    await pool.query(
      'UPDATE channels SET offline_since = NULL WHERE twitch_user_id = $1',
      [broadcasterId]
    ).catch(err => console.error(`Failed to update online state for ${broadcasterId}:`, err.message));
    await logEvent(broadcasterId, 'stream_online');
  } else {
    await flushWatchtimes(broadcasterId);
    await pool.query(
      'UPDATE channels SET offline_since = NOW() WHERE twitch_user_id = $1',
      [broadcasterId]
    ).catch(err => console.error(`Failed to update offline state for ${broadcasterId}:`, err.message));
    await logEvent(broadcasterId, 'stream_offline');
  }
  configCache.delete(broadcasterId);
  console.log(`Stream ${isLive ? 'online' : 'offline'}: ${broadcasterId}`);
});

manager.onReconnect(subscribeAll);

async function subscribeAll() {
  const { rows } = await pool.query(
    'SELECT twitch_user_id, twitch_login FROM channels'
  );
  for (const row of rows) {
    try {
      await manager.subscribeToChannel(row.twitch_user_id);
      console.log(`Subscribed to #${row.twitch_login}`);
    } catch (err) {
      console.error(`Failed to subscribe to #${row.twitch_login}:`, err.message);
    }
  }
}

async function pollNewChannels() {
  // Check for reconnect requests
  const reconnectRows = await pool.query(
    `SELECT twitch_user_id FROM channels WHERE reconnect_requested_at IS NOT NULL
     AND reconnect_requested_at > NOW() - INTERVAL '2 minutes'`
  );
  if (reconnectRows.rows.length > 0) {
    for (const row of reconnectRows.rows) {
      manager.unsubscribeChannel(row.twitch_user_id);
      configCache.delete(row.twitch_user_id);
      // Immediately re-subscribe
      await manager.subscribeToChannel(row.twitch_user_id).catch(err =>
        console.error(`Re-subscribe failed for ${row.twitch_user_id}:`, err.message)
      );
    }
    await pool.query(
      `UPDATE channels SET reconnect_requested_at = NULL WHERE reconnect_requested_at IS NOT NULL`
    );
    console.log(`Reconnect triggered for ${reconnectRows.rows.length} channel(s)`);
  }

  const { rows } = await pool.query(
    'SELECT twitch_user_id, twitch_login FROM channels WHERE bot_active = false'
  );
  for (const row of rows) {
    try {
      await manager.subscribeToChannel(row.twitch_user_id);
      await pool.query(
        'UPDATE channels SET bot_active = true WHERE twitch_user_id = $1',
        [row.twitch_user_id]
      );
      console.log(`Bot joined #${row.twitch_login}`);
    } catch (err) {
      console.error(`Failed to join #${row.twitch_login}:`, err.message);
    }
  }
}

let pollInterval = null;

async function main() {
  await manager.connect();
  console.log('EventSub WebSocket connected');

  await subscribeAll();
  pollInterval = setInterval(pollNewChannels, 30_000);

  console.log('MapleBot ready');
}

async function shutdown(signal) {
  console.log(`\nReceived ${signal} — flushing watchtimes and shutting down...`);
  if (pollInterval) clearInterval(pollInterval);
  const channelIds = [...sessionMap.keys()];
  await Promise.allSettled(channelIds.map(id => flushWatchtimes(id)));
  console.log('Watchtimes flushed. Goodbye.');
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('MapleBot failed to start:', err);
  process.exit(1);
});
