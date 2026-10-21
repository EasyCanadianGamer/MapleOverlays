import { useState, useEffect, useRef } from 'react';
import { getToken } from '../lib/twitchAuth';
import type { TwitchUser } from '../lib/twitchAuth';
import { fetchStreamInfo, updateStreamInfo } from '../lib/twitchApi';
import type { StreamInfo } from '../lib/twitchApi';

interface UseStreamInfoResult {
  info: StreamInfo | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  save: (title: string, gameId: string) => Promise<void>;
}

export function useStreamInfo(user: TwitchUser | null): UseStreamInfoResult {
  const [info, setInfo]       = useState<StreamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    fetchStreamInfo(token, user.id)
      .then(i => {
        if (!cancelled) { setInfo(i); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const save = async (title: string, gameId: string) => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateStreamInfo(token, user.id, { title, game_id: gameId });
      if (!mountedRef.current) return;
      setInfo(prev => prev ? { ...prev, title, game_id: gameId } : prev);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  return { info, loading, saving, error, save };
}
