const {
  getBroadcasterStream,
  getChannelInfo,
  getUserIdByLogin,
  getFollowAge,
  getSubAge,
} = require('./twitch');
const defaultPool = require('./db');

function sinceWhen(isoString) {
  const days = Math.floor((Date.now() - new Date(isoString).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}yr`;
}

async function resolveTemplate(template, { broadcasterId, broadcasterLogin, chatterId, chatterLogin, arg, accessToken, command } = {}, { db } = {}) {
  if (typeof template !== 'string') return '';
  const pool = db ?? defaultPool;

  // Collect unique variable names used in this template
  const used = new Set();
  for (const [, key] of template.matchAll(/\{([^}]+)\}/g)) {
    used.add(key === 'channel.game' ? 'game' : key);
  }

  if (used.size === 0) return template;

  // Shared promises — deduplicates API calls when multiple vars need the same fetch
  let streamPromise = null;
  let chatterIdPromise = null;

  function getStream() {
    streamPromise ??= getBroadcasterStream(broadcasterId).catch(() => null);
    return streamPromise;
  }

  function getChatterId() {
    if (chatterId) return Promise.resolve(chatterId);
    chatterIdPromise ??= getUserIdByLogin(chatterLogin).catch(() => null);
    return chatterIdPromise;
  }

  // Build resolver map — only for vars that are actually used
  const resolvers = {};

  if (used.has('channel'))  resolvers['channel']  = async () => broadcasterLogin ?? '';
  if (used.has('user'))     resolvers['user']      = async () => chatterLogin ?? '';
  if (used.has('1'))        resolvers['1']         = async () => arg ?? '';

  if (used.has('game')) {
    resolvers['game'] = async () => {
      try {
        const stream = await getStream();
        if (stream?.game_name) return stream.game_name;
        const channel = await getChannelInfo(broadcasterId);
        return channel?.game_name ?? '[unavailable]';
      } catch { return '[unavailable]'; }
    };
  }

  if (used.has('channel.viewers')) {
    resolvers['channel.viewers'] = async () => {
      try {
        const stream = await getStream();
        return stream?.viewer_count != null ? String(stream.viewer_count) : '0';
      } catch { return '[unavailable]'; }
    };
  }

  if (used.has('1.game')) {
    resolvers['1.game'] = async () => {
      if (!arg) return '[unavailable]';
      try {
        const userId = await getUserIdByLogin(arg);
        if (!userId) return '[unavailable]';
        const stream = await getBroadcasterStream(userId);
        return stream?.game_name ?? '[not live]';
      } catch { return '[unavailable]'; }
    };
  }

  if (used.has('1.count')) {
    resolvers['1.count'] = async () => {
      if (!broadcasterId || !command || !arg) return '0';
      try {
        const { rows } = await pool.query(
          `INSERT INTO command_target_counts (twitch_user_id, command, target, count)
           VALUES ($1, $2, $3, 1)
           ON CONFLICT (twitch_user_id, command, target)
           DO UPDATE SET count = command_target_counts.count + 1
           RETURNING count`,
          [broadcasterId, command, arg]
        );
        return String(rows[0]?.count ?? 0);
      } catch { return '0'; }
    };
  }

  if (used.has('user.follow')) {
    resolvers['user.follow'] = async () => {
      if (!accessToken) return '[unavailable]';
      try {
        const uid = await getChatterId();
        if (!uid) return '[unavailable]';
        const followedAt = await getFollowAge(accessToken, broadcasterId, uid);
        return followedAt ? sinceWhen(followedAt) : '[not following]';
      } catch { return '[unavailable]'; }
    };
  }

  if (used.has('user.subscribe')) {
    resolvers['user.subscribe'] = async () => {
      if (!accessToken) return '[unavailable]';
      try {
        const uid = await getChatterId();
        if (!uid) return '[unavailable]';
        const sub = await getSubAge(accessToken, broadcasterId, uid);
        if (!sub) return '[not subscribed]';
        const tiers = { '1000': 'Tier 1', '2000': 'Tier 2', '3000': 'Tier 3' };
        return tiers[sub.tier] ?? 'subscriber';
      } catch { return '[unavailable]'; }
    };
  }

  // {count} — atomically increment this command's counter and return new value.
  // Requires the command to have a row in command_configs (custom commands always do;
  // built-in commands only if the user has saved a custom response for them).
  if (used.has('count')) {
    resolvers['count'] = async () => {
      if (!broadcasterId || !command) return '0';
      try {
        const { rows } = await pool.query(
          'UPDATE command_configs SET count = count + 1 WHERE twitch_user_id = $1 AND command = $2 RETURNING count',
          [broadcasterId, command]
        );
        return String(rows[0]?.count ?? 0);
      } catch { return '0'; }
    };
  }

  // {getcount commandname} — read another command's count without incrementing
  for (const key of used) {
    if (key.startsWith('getcount ')) {
      const targetCmd = key.slice('getcount '.length).trim();
      resolvers[key] = async () => {
        if (!broadcasterId || !targetCmd) return '0';
        try {
          const { rows } = await pool.query(
            'SELECT count FROM command_configs WHERE twitch_user_id = $1 AND command = $2',
            [broadcasterId, targetCmd]
          );
          return String(rows[0]?.count ?? 0);
        } catch { return '0'; }
      };
    }
  }

  // Resolve all used vars in parallel
  const keys = Object.keys(resolvers);
  const values = await Promise.all(keys.map(k => resolvers[k]()));
  const resolved = Object.fromEntries(keys.map((k, i) => [k, values[i]]));

  // Substitute — normalize channel.game alias to the resolved game value
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const normalized = key === 'channel.game' ? 'game' : key;
    return resolved[normalized] ?? '';
  });
}

module.exports = { resolveTemplate };
