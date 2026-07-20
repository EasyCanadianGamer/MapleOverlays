if (!process.env.BOT_ACCESS_TOKEN) throw new Error('Missing required env var: BOT_ACCESS_TOKEN');
if (!process.env.TWITCH_CLIENT_ID)  throw new Error('Missing required env var: TWITCH_CLIENT_ID');
if (!process.env.BOT_USER_ID)       throw new Error('Missing required env var: BOT_USER_ID');

const WebSocket = require('ws');
const { refreshBotToken } = require('./twitch');

class EventSubManager {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.sessionId = null;
    this.ws = null;
    this.subscribedChannels = new Set();
    this._onReconnect = null;
    this._onStreamState = null;
  }

  onReconnect(fn) {
    this._onReconnect = fn;
  }

  onStreamState(fn) {
    this._onStreamState = fn;
  }

  connect(url = 'wss://eventsub.wss.twitch.tv/ws') {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.once('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.metadata.message_type === 'session_welcome') {
          this.sessionId = msg.payload.session.id;
          ws.on('message', (d) => this._handleMessage(d));
          ws.on('error', (err) => console.error('EventSub WebSocket error:', err.message));
          resolve();
        } else {
          reject(new Error(`Unexpected first message type: ${msg.metadata.message_type}`));
        }
      });

      ws.once('error', reject);
      // Only trigger reconnect logic if this socket is still the active one.
      // _handleReconnect replaces this.ws before closing the old socket, so
      // closing the old socket must not wipe the new session's state.
      ws.on('close', () => { if (this.ws === ws) this._handleClose(); });
    });
  }

  async _handleClose() {
    this.sessionId = null;
    this.subscribedChannels.clear();
    const MAX_ATTEMPTS = 10;
    const BASE_DELAY   = 1000;
    const MAX_DELAY    = 30_000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const delay = Math.min(BASE_DELAY * 2 ** (attempt - 1), MAX_DELAY);
      console.log(`EventSub closed — reconnecting in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS})...`);
      await new Promise(r => setTimeout(r, delay));
      try {
        await this.connect();
        if (this._onReconnect) {
          try { await this._onReconnect(); } catch (err) { console.error('Reconnect callback failed:', err.message); }
        }
        return;
      } catch (err) {
        console.error(`Reconnection attempt ${attempt} failed:`, err.message);
      }
    }
    console.error('EventSub: max reconnection attempts reached. Exiting.');
    process.exit(1);
  }

  async _handleReconnect(reconnectUrl) {
    console.log('EventSub session_reconnect received — migrating to new session...');
    const oldWs = this.ws;
    try {
      await this.connect(reconnectUrl);
      if (this._onReconnect) {
        try { await this._onReconnect(); } catch (err) { console.error('Reconnect callback failed:', err.message); }
      }
      oldWs.close();
      console.log('EventSub session migrated successfully');
    } catch (err) {
      console.error('EventSub session migration failed, falling back to reconnect:', err.message);
      oldWs.close();
    }
  }

  _handleMessage(data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (!msg?.metadata?.message_type) return;
    const { message_type, subscription_type } = msg.metadata;

    if (message_type === 'session_reconnect') {
      const reconnectUrl = msg.payload?.session?.reconnect_url;
      if (reconnectUrl) this._handleReconnect(reconnectUrl).catch(() => {});
      return;
    }

    if (message_type !== 'notification') return;

    const event = msg.payload?.event;
    if (!event) return;

    if (subscription_type === 'channel.chat.message') {
      const broadcasterId    = event.broadcaster_user_id;
      const broadcasterLogin = event.broadcaster_user_login;
      const chatterId        = event.chatter_user_id;
      const chatterLogin     = event.chatter_user_login;
      const text             = event.message?.text;
      if (!broadcasterId || !text) return;
      const isSubscriber = event.badges?.some(b => b.set_id === 'subscriber' || b.set_id === 'founder') ?? false;
      const emoteCount   = event.message?.fragments?.filter(f => f.type === 'emote').length ?? 0;
      const messageId    = event.message_id ?? '';
      this.onMessage(broadcasterId, broadcasterLogin, chatterId, chatterLogin, text, { isSubscriber, emoteCount, messageId });
    } else if (subscription_type === 'stream.offline') {
      if (event.broadcaster_user_id) this._onStreamState?.(event.broadcaster_user_id, false);
    } else if (subscription_type === 'stream.online') {
      if (event.broadcaster_user_id) this._onStreamState?.(event.broadcaster_user_id, true);
    }
  }

  async _subscribe(type, condition) {
    const body = JSON.stringify({
      type,
      version: '1',
      condition,
      transport: { method: 'websocket', session_id: this.sessionId },
    });

    const attempt = (token) => fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body,
    });

    let res = await attempt(process.env.BOT_ACCESS_TOKEN);

    if (res.status === 401 && process.env.BOT_REFRESH_TOKEN) {
      const newToken = await refreshBotToken();
      res = await attempt(newToken);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`EventSub subscription failed (${type}): ${res.status} ${text}`);
    }
  }

  unsubscribeChannel(broadcasterId) {
    this.subscribedChannels.delete(broadcasterId);
  }

  getChannelIds() {
    return [...this.subscribedChannels];
  }

  async subscribeToChannel(broadcasterId) {
    if (this.subscribedChannels.has(broadcasterId)) return;
    if (!this.sessionId) throw new Error('Not connected to EventSub — session ID not available');

    const results = await Promise.allSettled([
      this._subscribe('channel.chat.message', {
        broadcaster_user_id: broadcasterId,
        user_id: process.env.BOT_USER_ID,
      }),
      this._subscribe('stream.offline', { broadcaster_user_id: broadcasterId }),
      this._subscribe('stream.online',  { broadcaster_user_id: broadcasterId }),
    ]);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      const errors = failures.map(f => f.reason.message).join('; ');
      throw new Error(`Failed to subscribe to some EventSub events for ${broadcasterId}: ${errors}`);
    }

    this.subscribedChannels.add(broadcasterId);
  }
}

module.exports = EventSubManager;
