import { parseLine, type ChatEvent } from './irc';

// Reads a channel's chat anonymously (read-only, no token). Reconnects with
// backoff because an OBS browser source can sit open for many hours.
// Returns a function that closes the connection for good.
export function connectChat(channel: string, onEvent: (event: ChatEvent) => void): () => void {
  let closed = false;
  let socket: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    socket = ws;

    ws.onopen = () => {
      attempt = 0;
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK justinfan${Math.floor(Math.random() * 99999) + 1}`);
      ws.send(`JOIN #${channel.toLowerCase()}`);
    };

    // Twitch packs several lines into one frame, separated by \r\n.
    ws.onmessage = (e: MessageEvent) => {
      for (const line of String(e.data).split('\r\n')) {
        if (!line) continue;
        const signal = parseLine(line);
        if (!signal) continue;
        if (signal.kind === 'ping') ws.send('PONG :tmi.twitch.tv');
        else if (signal.kind !== 'joined') onEvent(signal);
      }
    };

    ws.onclose = () => {
      if (closed) return;
      const delay = Math.min(30_000, 1000 * 2 ** attempt);
      attempt += 1;
      timer = setTimeout(open, delay);
    };
  };

  open();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    socket?.close();
  };
}
