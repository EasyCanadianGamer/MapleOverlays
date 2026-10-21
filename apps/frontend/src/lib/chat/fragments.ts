import type { EmoteRange } from './irc';

export type Fragment =
  | { type: 'text'; text: string }
  | { type: 'emote'; name: string; url: string };

export interface ThirdPartyEmotes {
  sevenTv: Record<string, string>;
  bttv: Record<string, string>;
  ffz: Record<string, string>;
}
export interface EmoteOptions { twitch: boolean; sevenTv: boolean; bttv: boolean; ffz: boolean }

export const twitchEmoteUrl = (id: string) =>
  `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/2.0`;

// Emote names come from viewers and third parties, so only own properties count:
// a viewer typing "constructor" must not match Object.prototype.constructor.
const has = (map: Record<string, string>, key: string) => Object.prototype.hasOwnProperty.call(map, key);

function lookup(word: string, tp: ThirdPartyEmotes, opts: EmoteOptions): string | null {
  if (opts.sevenTv && has(tp.sevenTv, word)) return tp.sevenTv[word];
  if (opts.bttv && has(tp.bttv, word)) return tp.bttv[word];
  if (opts.ffz && has(tp.ffz, word)) return tp.ffz[word];
  return null;
}

function pushText(out: Fragment[], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === 'text') last.text += text;
  else out.push({ type: 'text', text });
}

function pushWords(out: Fragment[], text: string, tp: ThirdPartyEmotes, opts: EmoteOptions): void {
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    const url = /^\s+$/.test(token) ? null : lookup(token, tp, opts);
    if (url) out.push({ type: 'emote', name: token, url });
    else pushText(out, token);
  }
}

// Turns a message into text and emote fragments. Twitch emotes come from the
// IRC `emotes` tag (code point ranges); 7TV, BTTV and FFZ emotes are matched
// against whole words.
export function buildFragments(text: string, ranges: EmoteRange[], tp: ThirdPartyEmotes, opts: EmoteOptions): Fragment[] {
  const chars = Array.from(text);

  const valid: EmoteRange[] = [];
  let cursor = 0;
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (range.start < cursor || range.start > range.end || range.end >= chars.length) continue;
    valid.push(range);
    cursor = range.end + 1;
  }

  const out: Fragment[] = [];
  let pos = 0;
  for (const range of valid) {
    pushWords(out, chars.slice(pos, range.start).join(''), tp, opts);
    const name = chars.slice(range.start, range.end + 1).join('');
    if (opts.twitch) out.push({ type: 'emote', name, url: twitchEmoteUrl(range.id) });
    else pushWords(out, name, tp, opts);
    pos = range.end + 1;
  }
  pushWords(out, chars.slice(pos).join(''), tp, opts);
  return out;
}
