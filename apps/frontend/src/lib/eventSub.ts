const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined;

export interface EventSubEvent {
  type: string;
  data: Record<string, string>;
}

export type EventSubHandler = (event: EventSubEvent) => void;

// Maps overlay ID → EventSub subscription config
const SUBS: Record<string, { type: string; version: string }> = {
  follow: { type: 'channel.follow',     version: '2' },
  sub:    { type: 'channel.subscribe',  version: '1' },
  bits:   { type: 'channel.cheer',      version: '1' },
  raid:   { type: 'channel.raid',       version: '1' },
};

function buildCondition(overlayId: string, uid: string): Record<string, string> {
  if (overlayId === 'follow') {
    // v2 requires both broadcaster and moderator (can be the same user)
    return { broadcaster_user_id: uid, moderator_user_id: uid };
  }
  if (overlayId === 'raid') {
    // "raid to" fires when someone raids INTO this channel
    return { to_broadcaster_user_id: uid };
  }
  return { broadcaster_user_id: uid };
}

async function createSubscription(
  sessionId: string,
  overlayId: string,
  token: string,
  uid: string,
): Promise<void> {
  if (!CLIENT_ID) return;
  const sub = SUBS[overlayId];
  if (!sub) return;
  try {
    const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Client-Id':    CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type:      sub.type,
        version:   sub.version,
        condition: buildCondition(overlayId, uid),
        transport: { method: 'websocket', session_id: sessionId },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`EventSub subscription failed for ${overlayId} (${res.status}):`, err);
    }
  } catch (err) {
    console.error('EventSub subscription network error:', err);
  }
}

/**
 * Connect to Twitch EventSub WebSocket and subscribe to the event that
 * corresponds to the given overlay ID. Fires onEvent for each notification.
 * Returns a cleanup function.
 */
export function connectEventSub(
  overlayId: string,
  token: string,
  uid: string,
  onEvent: EventSubHandler,
): () => void {
  if (!token || !uid || !CLIENT_ID || !SUBS[overlayId]) return () => {};

  const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

  ws.onmessage = (e: MessageEvent<string>) => {
    let msg: {
      metadata: { message_type: string };
      payload: {
        session?: { id: string; reconnect_url?: string };
        subscription?: { type: string };
        event?: Record<string, string>;
      };
    };
    try { msg = JSON.parse(e.data); } catch { return; }

    const msgType = msg.metadata.message_type;

    if (msgType === 'session_welcome' && msg.payload.session) {
      void createSubscription(msg.payload.session.id, overlayId, token, uid);
    }

    if (msgType === 'session_reconnect' && msg.payload.session?.reconnect_url) {
      const reconnectUrl = (msg.payload.session as { reconnect_url: string }).reconnect_url;
      const newWs = new WebSocket(reconnectUrl);
      newWs.onmessage = ws.onmessage;
      newWs.onerror = () => {};
      newWs.onopen = () => { ws.close(); };
    }

    if (msgType === 'notification' && msg.payload.event) {
      onEvent({
        type: msg.payload.subscription?.type ?? '',
        data: msg.payload.event,
      });
    }
  };

  ws.onerror = () => {};

  return () => ws.close();
}

/** Pull the viewer name + alert-specific values from raw EventSub event data. */
export function extractAlertData(
  overlayId: string,
  data: Record<string, string>,
): { user: string; amount: string; viewers: string } {
  switch (overlayId) {
    case 'follow': return { user: data.user_name ?? 'viewer', amount: '',              viewers: '' };
    case 'sub':    return { user: data.user_name ?? 'viewer', amount: data.tier ?? '', viewers: '' };
    case 'bits':   return { user: data.user_name ?? 'viewer', amount: data.bits ?? '', viewers: '' };
    case 'raid':   return { user: data.from_broadcaster_user_name ?? 'streamer', amount: '', viewers: data.viewers ?? '' };
    default:       return { user: 'viewer', amount: '', viewers: '' };
  }
}
