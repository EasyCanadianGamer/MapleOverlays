import { useEffect, useState } from 'react';
import ChatView, { asChatConfig, EMPTY_ASSETS } from './ChatView';
import ShadowHost from './ShadowHost';
import { MOCK_MESSAGES } from './chatMock';
import { getChatAssets, type ChatAssets, type OverlayConfig } from '../../lib/overlayApi';
import { getStoredUser } from '../../lib/twitchAuth';
import { useOverlayFont } from '../../lib/useOverlayFont';

export default function ChatPreview({ config }: { config: OverlayConfig }) {
  const login = getStoredUser()?.login;
  const [assets, setAssets] = useState<ChatAssets>(EMPTY_ASSETS);

  // Use the streamer's own badges and emotes in the preview when they are available.
  useEffect(() => {
    if (!login) return;
    let cancelled = false;
    getChatAssets(login).then(next => { if (!cancelled && next) setAssets(next); });
    return () => { cancelled = true; };
  }, [login]);

  const chat = asChatConfig(config);
  useOverlayFont(chat.font);
  // The shadow root keeps the overlay's custom CSS from leaking into the dashboard.
  return <ShadowHost><ChatView config={chat} messages={MOCK_MESSAGES} assets={assets} /></ShadowHost>;
}
