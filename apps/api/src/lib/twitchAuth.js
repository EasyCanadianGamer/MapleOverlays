async function getCallerTwitchUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const res = await fetch('https://api.twitch.tv/helix/users', {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID },
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data?.[0] ?? null;
  } catch { return null; }
}

async function getCallerTwitchId(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const res = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
      },
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

module.exports = { getCallerTwitchUser, getCallerTwitchId };
