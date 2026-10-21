export interface Badge { set: string; version: string }
// start and end are code point indices into the message text, inclusive, as Twitch sends them.
export interface EmoteRange { id: string; start: number; end: number }

export interface ChatMessage {
  kind: 'message';
  id: string;
  login: string;
  displayName: string;
  color: string | null;
  badges: Badge[];
  emotes: EmoteRange[];
  text: string;
  isAction: boolean;
}
export interface ClearMsg { kind: 'clearmsg'; targetMsgId: string }
export interface ClearChat { kind: 'clearchat'; targetLogin: string | null }
export type ChatEvent = ChatMessage | ClearMsg | ClearChat;
export type IrcSignal = ChatEvent | { kind: 'ping' } | { kind: 'joined' } | null;

const TAG_ESCAPES: Record<string, string> = { ':': ';', s: ' ', r: '\r', n: '\n', '\\': '\\' };

function unescapeTag(value: string): string {
  return value.replace(/\\(.)/g, (_match, ch: string) => TAG_ESCAPES[ch] ?? ch);
}

export function parseTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = Object.create(null);
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) tags[part.slice(0, eq)] = unescapeTag(part.slice(eq + 1));
  }
  return tags;
}

export function parseBadges(value: string | undefined): Badge[] {
  if (!value) return [];
  const out: Badge[] = [];
  for (const part of value.split(',')) {
    const [set, version] = part.split('/');
    if (set && version !== undefined) out.push({ set, version });
  }
  return out;
}

export function parseEmoteTag(value: string | undefined): EmoteRange[] {
  if (!value) return [];
  const out: EmoteRange[] = [];
  for (const group of value.split('/')) {
    const [id, positions] = group.split(':');
    if (!id || !positions) continue;
    for (const pos of positions.split(',')) {
      const match = /^(\d+)-(\d+)$/.exec(pos);
      if (match) out.push({ id, start: Number(match[1]), end: Number(match[2]) });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// Parses one IRC line. Never throws: anything unrecognised is null.
export function parseLine(line: string): IrcSignal {
  if (line.startsWith('PING')) return { kind: 'ping' };

  let rest = line;
  let tags: Record<string, string> = Object.create(null);
  if (rest.startsWith('@')) {
    const end = rest.indexOf(' ');
    if (end < 0) return null;
    tags = parseTags(rest.slice(1, end));
    rest = rest.slice(end + 1);
  }

  let prefix = '';
  if (rest.startsWith(':')) {
    const end = rest.indexOf(' ');
    if (end < 0) return null;
    prefix = rest.slice(1, end);
    rest = rest.slice(end + 1);
  }

  const cmdEnd = rest.indexOf(' ');
  const command = cmdEnd < 0 ? rest : rest.slice(0, cmdEnd);
  const params = cmdEnd < 0 ? '' : rest.slice(cmdEnd + 1);
  const trailingAt = params.startsWith(':') ? -2 : params.indexOf(' :');
  const trailing = trailingAt === -2 ? params.slice(1) : trailingAt >= 0 ? params.slice(trailingAt + 2) : null;

  switch (command) {
    case '366':
      return { kind: 'joined' };
    case 'PRIVMSG': {
      if (trailing === null) return null;
      const login = prefix.split('!')[0] ?? '';
      if (!login) return null;
      let text = trailing;
      let isAction = false;
      if (text.startsWith('\u0001ACTION ') && text.endsWith('\u0001')) {
        text = text.slice(8, -1);
        isAction = true;
      }
      return {
        kind: 'message',
        id: tags.id ?? '',
        login,
        displayName: tags['display-name'] || login,
        color: tags.color || null,
        badges: parseBadges(tags.badges),
        emotes: parseEmoteTag(tags.emotes),
        text,
        isAction,
      };
    }
    case 'CLEARMSG': {
      const id = tags['target-msg-id'];
      return id ? { kind: 'clearmsg', targetMsgId: id } : null;
    }
    case 'CLEARCHAT':
      return { kind: 'clearchat', targetLogin: trailing ? trailing.toLowerCase() : null };
    default:
      return null;
  }
}
