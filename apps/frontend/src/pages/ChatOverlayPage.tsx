import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ChatView, { asChatConfig, EMPTY_ASSETS, type ChatConfig } from '../components/overlay/ChatView';
import { useChatFeed, type FeedOptions } from '../lib/chat/useChatFeed';
import { getChatAssets, getPublicOverlay, type ChatAssets } from '../lib/overlayApi';
import { reconcilePublic } from '../lib/publicOverlay';
import { useOverlayFont } from '../lib/useOverlayFont';

const CONFIG_POLL_MS = 15_000;
const ASSET_REFRESH_MS = 10 * 60_000;

interface Loaded { config: ChatConfig; channel: string }

export default function ChatOverlayPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [state, setState] = useState<Loaded | null>(null);
  const [assets, setAssets] = useState<ChatAssets>(EMPTY_ASSETS);
  const lastSeen = useRef('');

  // Re-read the config every 15 s so changes made in the dashboard reach OBS without a refresh.
  // A network or server error keeps whatever is on screen; a 404 means the URL was revoked, so the page clears.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = reconcilePublic(await getPublicOverlay(token), 'chat');
        if (cancelled) return;
        if (!data) {
          // The URL was rotated or deleted: clear the page, which also stops reading chat.
          lastSeen.current = '';
          setState(null);
          return;
        }
        const signature = JSON.stringify([data.config, data.channel]);
        if (signature === lastSeen.current) return;
        lastSeen.current = signature;
        setState({ config: asChatConfig(data.config), channel: data.channel });
      } catch { /* keep the last good config */ }
    };
    void load();
    const timer = setInterval(() => void load(), CONFIG_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [token]);

  const channel = state?.channel ?? '';
  useEffect(() => {
    if (!channel) return;
    let cancelled = false;
    const load = async () => {
      const next = await getChatAssets(channel);
      if (!cancelled && next) setAssets(next);
    };
    void load();
    const timer = setInterval(() => void load(), ASSET_REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [channel]);

  const config = state?.config;
  useOverlayFont(config?.font ?? 'builtin:Geist');

  const feedOptions = useMemo<FeedOptions>(() => ({
    maxMessages: config?.maxMessages ?? 12,
    lifetimeSeconds: config?.lifetimeSeconds ?? 0,
    fadeSeconds: config?.fadeSeconds ?? 1,
    filters: {
      hideCommands: config?.hideCommands ?? true,
      hiddenUsers: config?.hiddenUsers ?? '',
      blockedWords: config?.blockedWords ?? '',
    },
  }), [config]);

  const messages = useChatFeed(channel, feedOptions);

  if (!state) return null;
  return <ChatView config={state.config} messages={messages} assets={assets} />;
}
