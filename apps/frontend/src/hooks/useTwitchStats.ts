import { useState, useEffect, useCallback } from 'react';
import { getToken } from '../lib/twitchAuth';
import type { TwitchUser } from '../lib/twitchAuth';
import { fetchChannelStats } from '../lib/twitchApi';
import type { ChannelStats } from '../lib/twitchApi';

interface UseTwitchStatsResult {
  stats: ChannelStats | null;
  loading: boolean;
  refresh: () => void;
}

const REFRESH_INTERVAL_MS = 60_000;

export function useTwitchStats(user: TwitchUser | null): UseTwitchStatsResult {
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    fetchChannelStats(token, user.id)
      .then(s => {
        if (!cancelled) { setStats(s); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, tick]);

  // Auto-refresh every minute while on the dashboard
  useEffect(() => {
    if (!user) return;
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, refresh]);

  return { stats, loading, refresh };
}
