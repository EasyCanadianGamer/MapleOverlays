export interface TwitchChatMessage {
  user: string;
  color: string;
  text: string;
  username: string;
  isMod: boolean;
  badges: string[];
}

export type MessageHandler = (msg: TwitchChatMessage) => void;

function parseTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  if (!raw.startsWith('@')) return tags;
  const tagStr = raw.slice(1, raw.indexOf(' '));
  for (const tag of tagStr.split(';')) {
    const eq = tag.indexOf('=');
    if (eq >= 0) tags[tag.slice(0, eq)] = tag.slice(eq + 1);
  }
  return tags;
}

function parseLine(line: string, onMessage: MessageHandler, onConnected?: () => void, ws?: WebSocket) {
  if (line.startsWith('PING')) {
    ws?.send('PONG :tmi.twitch.tv');
    return;
  }

  // 366 = end of /NAMES list → JOIN successful
  if (line.includes(' 366 ') && onConnected) {
    onConnected();
    return;
  }

  if (!line.includes('PRIVMSG')) return;

  const tags      = parseTags(line);
  const privIdx   = line.indexOf('PRIVMSG');
  const colonIdx  = line.indexOf(':', privIdx);
  if (colonIdx < 0) return;

  const text      = line.slice(colonIdx + 1);
  const userMatch = line.match(/:([^!]+)!/);
  const username  = userMatch ? userMatch[1] : 'viewer';
  const user      = tags['display-name'] || username;
  const color     = tags['color'] || '#B7AAAE';
  const isMod     = tags['mod'] === '1';
  const badges    = tags['badges'] ? tags['badges'].split(',').filter(Boolean) : [];

  onMessage({ user, color, text, username, isMod, badges });
}

/**
 * Connect to Twitch IRC anonymously (read-only, no token needed).
 * Returns a cleanup function that closes the socket.
 */
export function connectTwitchChat(
  channel: string,
  onMessage: MessageHandler,
  onConnected?: () => void,
): () => void {
  if (!channel.trim()) return () => {};

  const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws.send('PASS SCHMOOPIIE');
    ws.send(`NICK justinfan${Math.floor(Math.random() * 99999) + 1}`);
    ws.send(`JOIN #${channel.toLowerCase()}`);
  };

  // Twitch IRC sends multiple lines in one WebSocket frame separated by \r\n —
  // split and process each line individually.
  ws.onmessage = (e: MessageEvent<string>) => {
    const lines = e.data.split('\r\n').filter(Boolean);
    for (const line of lines) {
      parseLine(line, onMessage, onConnected, ws);
    }
  };

  ws.onerror = () => {};

  return () => ws.close();
}
