import { useState, useCallback, useEffect } from 'react';
import {
  getToken,
  getStoredUser,
  clearAuth,
  buildAuthUrl,
  fetchTwitchUser,
  type TwitchUser,
} from '../lib/twitchAuth';

interface TwitchAuthState {
  connected: boolean;
  user: TwitchUser | null;
  connect: () => void;
  disconnect: () => void;
}

export function useTwitchAuth(): TwitchAuthState {
  const [user, setUser] = useState<TwitchUser | null>(getStoredUser);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetchTwitchUser(token).catch(() => {
      clearAuth();
      setUser(null);
    });
  }, []);

  const connect = useCallback(() => {
    window.location.href = buildAuthUrl();
  }, []);

  const disconnect = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return {
    connected: !!getToken() && user !== null,
    user,
    connect,
    disconnect,
  };
}
