const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined;

function authHeaders(token: string): HeadersInit {
  if (!CLIENT_ID) throw new Error('VITE_TWITCH_CLIENT_ID is not set');
  return {
    Authorization: `Bearer ${token}`,
    'Client-Id': CLIENT_ID,
  };
}

export interface ChannelStats {
  followers: number | null;
  subscribers: number | null; // null = not affiliate/partner, or insufficient scope
  viewerCount: number | null; // null = offline
  isLive: boolean;
  startedAt: string | null;  // ISO timestamp from Twitch, null when offline
}

export async function fetchChannelStats(token: string, broadcasterId: string): Promise<ChannelStats> {
  const h = authHeaders(token);

  const [followersRes, subsRes, streamRes] = await Promise.allSettled([
    fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`,
      { headers: h },
    ),
    fetch(
      `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&first=1`,
      { headers: h },
    ),
    fetch(
      `https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`,
      { headers: h },
    ),
  ]);

  const followers = await safeJson<{ total?: number }>(followersRes);
  const subs      = await safeJson<{ total?: number }>(subsRes);
  const stream    = await safeJson<{ data?: Array<{ viewer_count: number; started_at: string }> }>(streamRes);

  const isLive = (stream?.data?.length ?? 0) > 0;

  return {
    followers:   followers?.total ?? null,
    subscribers: subs?.total     ?? null,
    viewerCount: stream?.data?.[0]?.viewer_count ?? null,
    isLive,
    startedAt:   stream?.data?.[0]?.started_at ?? null,
  };
}

// ── Stream info ───────────────────────────────────────────────────────────────

export interface StreamInfo {
  title: string;
  game_id: string;
  game_name: string;
}

export async function fetchStreamInfo(token: string, broadcasterId: string): Promise<StreamInfo> {
  const res = await fetch(
    `https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Twitch API error: ${res.status}`);
  const json = await res.json() as { data: StreamInfo[] };
  const ch = json.data[0];
  if (!ch) throw new Error('No channel data returned');
  return ch;
}

export async function updateStreamInfo(
  token: string,
  broadcasterId: string,
  patch: { title?: string; game_id?: string },
): Promise<void> {
  const res = await fetch(
    `https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(token) as Record<string, string>, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update channel (${res.status}): ${text}`);
  }
}

export interface TwitchCategory {
  id: string;
  name: string;
  box_art_url: string;
}

export async function searchCategories(token: string, query: string): Promise<TwitchCategory[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ query, first: '8' });
  const res = await fetch(
    `https://api.twitch.tv/helix/search/categories?${params}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) return [];
  const json = await res.json() as { data: TwitchCategory[] };
  return json.data ?? [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeJson<T>(result: PromiseSettledResult<Response>): Promise<T | null> {
  if (result.status === 'rejected') return null;
  if (!result.value.ok) return null;
  try {
    return await result.value.json() as T;
  } catch {
    return null;
  }
}
