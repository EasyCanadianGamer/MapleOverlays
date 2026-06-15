const { getNowPlaying } = require('@maple/lastfm');
const { getBroadcasterStream, getFollowAge, getUserCreatedAt } = require('./twitch');
const { resolveTemplate } = require('./template');

function formatDuration(since) {
  const ms   = Date.now() - new Date(since).getTime();
  const days = Math.floor(ms / 86_400_000);
  const h    = Math.floor((ms % 86_400_000) / 3_600_000);
  const m    = Math.floor((ms % 3_600_000)  / 60_000);
  if (days > 0) return `${days}d ${h}h`;
  if (h > 0)    return `${h}h ${m}m`;
  return `${m}m`;
}

function formatAccountAge(since) {
  const start = new Date(since);
  const now   = new Date();

  let years  = now.getFullYear() - start.getFullYear();
  let months = now.getMonth()    - start.getMonth();
  let days   = now.getDate()     - start.getDate();
  let hours  = now.getHours()    - start.getHours();

  if (hours  < 0) { hours  += 24; days--; }
  if (days   < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { months += 12; years--; }

  const parts = [];
  if (years  > 0) parts.push(`${years}yr`);
  if (months > 0) parts.push(`${months}mo`);
  if (days   > 0) parts.push(`${days}d`);
  if (hours  > 0) parts.push(`${hours}h`);
  return parts.length ? parts.join(' ') : '< 1h';
}

function formatSeconds(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const h    = Math.floor((totalSeconds % 86400) / 3600);
  const m    = Math.floor((totalSeconds % 3600)  / 60);
  if (days > 0) return `${days}d ${h}h`;
  if (h > 0)    return `${h}h ${m}m`;
  return `${m}m`;
}

async function handleCommand(message, {
  broadcasterId,
  broadcasterLogin,
  chatterId,
  chatterLogin,
  lastfmUsername,
  commandConfigs = {},
  accessToken = null,
  offlineSince = null,
  tipUrl = null,
  getWatchtime = null,
} = {}) {
  const text = message.trim();

  const parts = text.startsWith('!') ? text.slice(1).split(/\s+/) : [];
  const arg   = (parts[1] ?? '').replace(/^@/, '') || null;

  const ctx = { broadcasterId, broadcasterLogin, chatterId, chatterLogin, arg, accessToken };

  function cfg(key) {
    return commandConfigs[key] ?? { enabled: true, response: null };
  }

  if (text === '!ping') {
    const { enabled, response } = cfg('ping');
    if (!enabled) return null;
    return resolveTemplate(response ?? 'pong!', ctx);
  }
  if (text === '!song') {
    const { enabled } = cfg('song');
    if (!enabled) return null;
    if (!lastfmUsername) return 'No Last.fm username configured for this channel.';
    return getNowPlaying(lastfmUsername);
  }
  if (text === '!uptime') {
    const { enabled, response } = cfg('uptime');
    if (!enabled) return null;
    if (!broadcasterId) return null;
    const stream = await getBroadcasterStream(broadcasterId);
    if (!stream) return 'The stream is currently offline.';
    const defaultMsg = `Stream has been live for ${formatDuration(stream.started_at)}.`;
    return response ? resolveTemplate(response, ctx) : defaultMsg;
  }
  if (text === '!downtime') {
    const { enabled, response } = cfg('downtime');
    if (!enabled) return null;
    if (!broadcasterId) return null;
    const stream = await getBroadcasterStream(broadcasterId);
    if (stream) return response ? resolveTemplate(response, ctx) : 'The stream is currently live.';
    if (offlineSince) {
      const defaultMsg = `Stream has been offline for ${formatDuration(offlineSince)}.`;
      return response ? resolveTemplate(response, ctx) : defaultMsg;
    }
    return 'The stream is currently offline.';
  }
  if (text === '!followage') {
    const { enabled, response } = cfg('followage');
    if (!enabled) return null;
    if (!accessToken || !broadcasterId || !chatterId) return null;
    try {
      const followedAt = await getFollowAge(accessToken, broadcasterId, chatterId);
      if (!followedAt) return `@${chatterLogin} is not following the channel.`;
      const defaultMsg = `@${chatterLogin} has been following for ${formatDuration(followedAt)}.`;
      return response ? resolveTemplate(response, ctx) : defaultMsg;
    } catch {
      return null;
    }
  }
  if (text === '!accountage') {
    const { enabled, response } = cfg('accountage');
    if (!enabled) return null;
    if (!chatterLogin) return null;
    try {
      const createdAt = await getUserCreatedAt(chatterLogin);
      if (!createdAt) return null;
      const defaultMsg = `@${chatterLogin}'s account is ${formatAccountAge(createdAt)} old.`;
      return response ? resolveTemplate(response, ctx) : defaultMsg;
    } catch {
      return null;
    }
  }
  if (text === '!watchtime') {
    const { enabled, response } = cfg('watchtime');
    if (!enabled) return null;
    if (!getWatchtime) return null;
    try {
      const totalSeconds = await getWatchtime();
      if (totalSeconds < 60) return `@${chatterLogin} has just started watching!`;
      const defaultMsg = `@${chatterLogin} has watched for ${formatSeconds(totalSeconds)}.`;
      return response ? resolveTemplate(response, ctx) : defaultMsg;
    } catch {
      return null;
    }
  }
  if (text === '!tip') {
    const { enabled, response } = cfg('tip');
    if (!enabled) return null;
    if (response) return resolveTemplate(response, ctx);
    if (tipUrl) return `Support the stream: ${tipUrl}`;
    return 'No tip link set up yet.';
  }
  if (text === '!commands') {
    const { enabled, response } = cfg('commands');
    if (!enabled) return null;
    if (response) return resolveTemplate(response, ctx);
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://maple.canadian-gamer.com';
    return `Command list: ${frontendUrl}/commands/${broadcasterLogin}`;
  }

  // Custom command fallback — any DB command with a response template
  if (text.startsWith('!')) {
    const cmdName = parts[0]?.toLowerCase();
    const custom = cfg(cmdName);
    if (custom.enabled && custom.response) {
      return resolveTemplate(custom.response, ctx);
    }
  }

  return null;
}

module.exports = { handleCommand };
