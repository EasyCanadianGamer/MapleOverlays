import type { CSSProperties } from 'react';
import { buildFragments, type EmoteOptions } from '../../lib/chat/fragments';
import type { Badge, EmoteRange } from '../../lib/chat/irc';
import { cssFamily } from '../../lib/fontRef';
import type { ChatAssets, OverlayConfig } from '../../lib/overlayApi';

// Mirrors the "chat" schema in apps/api/src/lib/overlaySchema.js. The API always
// sends every key, so no field here is optional.
export interface ChatConfig {
  direction: 'top' | 'bottom';
  maxMessages: number;
  lifetimeSeconds: number;
  fadeSeconds: number;
  spacing: number;
  font: string;
  fontSize: number;
  fontWeight: string;
  textColor: string;
  textShadow: boolean;
  useTwitchColor: boolean;
  usernameColor: string;
  usernameBold: boolean;
  showBadges: boolean;
  bgColor: string;
  bgOpacity: number;
  borderWidth: number;
  borderColor: string;
  radius: number;
  padding: number;
  bubble: boolean;
  entrance: 'none' | 'fade' | 'slide' | 'pop';
  animationMs: number;
  hideCommands: boolean;
  hiddenUsers: string;
  blockedWords: string;
  emoteScale: number;
  twitchEmotes: boolean;
  sevenTv: boolean;
  bttv: boolean;
  ffz: boolean;
  customCss: string;
}

export interface ViewMessage {
  key: number;
  login: string;
  displayName: string;
  color: string | null;
  badges: Badge[];
  emotes: EmoteRange[];
  text: string;
  isAction: boolean;
  leaving: boolean;
}

export const EMPTY_ASSETS: ChatAssets = { badges: {}, emotes: { sevenTv: {}, bttv: {}, ffz: {} } };

export const asChatConfig = (config: OverlayConfig): ChatConfig => config as unknown as ChatConfig;

const KEYFRAMES = `
@keyframes mw-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes mw-slide { from { opacity: 0; transform: translateX(-28px) } to { opacity: 1; transform: none } }
@keyframes mw-pop { from { opacity: 0; transform: scale(.82) } to { opacity: 1; transform: none } }
.mw-enter-fade { animation: mw-fade var(--mw-anim-ms) ease-out both }
.mw-enter-slide { animation: mw-slide var(--mw-anim-ms) cubic-bezier(.22,1,.36,1) both }
.mw-enter-pop { animation: mw-pop var(--mw-anim-ms) cubic-bezier(.34,1.56,.64,1) both }
.mw-msg { transition: opacity var(--mw-fade-s) ease }
.mw-msg.mw-leaving { opacity: 0 }
`;

function rgba(hex: string, opacityPercent: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacityPercent / 100})`;
}

interface LineProps {
  m: ViewMessage;
  c: ChatConfig;
  assets: ChatAssets;
  emoteOptions: EmoteOptions;
  box: CSSProperties | undefined;
}

function ChatLine({ m, c, assets, emoteOptions, box }: LineProps) {
  const fragments = buildFragments(m.text, m.emotes, assets.emotes, emoteOptions);
  const userColor = c.useTwitchColor && m.color ? m.color : c.usernameColor;
  const emoteHeight = `${(1.5 * c.emoteScale) / 100}em`;

  return (
    <div className={`mw-msg mw-enter-${c.entrance}${m.leaving ? ' mw-leaving' : ''}`} style={box}>
      {c.showBadges && m.badges.map(b => {
        const url = assets.badges[`${b.set}/${b.version}`];
        return url
          ? <img key={`${b.set}/${b.version}`} className="mw-badge" src={url} alt="" style={{ height: '1.15em', verticalAlign: 'middle', marginRight: 4 }} />
          : null;
      })}
      <span className="mw-user" style={{ color: userColor, fontWeight: c.usernameBold ? 700 : undefined }}>{m.displayName}</span>
      {m.isAction ? ' ' : <span className="mw-sep">: </span>}
      <span className="mw-text" style={m.isAction ? { color: userColor, fontStyle: 'italic' } : undefined}>
        {fragments.map((f, i) => f.type === 'emote'
          ? <img key={i} className="mw-emote" src={f.url} alt={f.name} title={f.name} style={{ height: emoteHeight, verticalAlign: 'middle', margin: '-0.2em 1px' }} />
          : <span key={i}>{f.text}</span>)}
      </span>
    </div>
  );
}

export interface ChatViewProps {
  config: ChatConfig;
  messages: ViewMessage[];
  assets: ChatAssets;
}

export default function ChatView({ config: c, messages, assets }: ChatViewProps) {
  const emoteOptions: EmoteOptions = { twitch: c.twitchEmotes, sevenTv: c.sevenTv, bttv: c.bttv, ffz: c.ffz };
  const visible = messages.slice(-c.maxMessages);
  const ordered = c.direction === 'top' ? [...visible].reverse() : visible;

  const box: CSSProperties = {
    background: rgba(c.bgColor, c.bgOpacity),
    border: c.borderWidth > 0 ? `${c.borderWidth}px solid ${c.borderColor}` : undefined,
    borderRadius: c.radius,
    padding: c.padding,
    boxSizing: 'border-box',
  };

  const container = {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: c.spacing,
    justifyContent: c.direction === 'top' ? 'flex-start' : 'flex-end',
    fontFamily: cssFamily(c.font),
    fontSize: c.fontSize,
    fontWeight: Number(c.fontWeight),
    color: c.textColor,
    textShadow: c.textShadow ? '0 1px 3px rgba(0,0,0,.85)' : undefined,
    lineHeight: 1.35,
    wordBreak: 'break-word',
    '--mw-anim-ms': `${c.animationMs}ms`,
    '--mw-fade-s': `${c.fadeSeconds}s`,
    ...(c.bubble ? {} : box),
  } as CSSProperties;

  return (
    <div className="mw-chat" style={container}>
      <style>{KEYFRAMES}</style>
      {c.customCss ? <style>{c.customCss}</style> : null}
      {ordered.map(m => (
        <ChatLine key={m.key} m={m} c={c} assets={assets} emoteOptions={emoteOptions} box={c.bubble ? box : undefined} />
      ))}
    </div>
  );
}
