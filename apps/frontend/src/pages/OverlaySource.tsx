import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { playOverlaySound } from '../lib/sounds';
import { connectTwitchChat } from '../lib/twitchChat';
import { connectEventSub, extractAlertData } from '../lib/eventSub';
import NowPlayingOverlay from './NowPlayingOverlay';

// ── Config ────────────────────────────────────────────────────────────────────

interface OverlayConfig {
  accentColor: string;
  duration: number;
  sound: boolean;
  message: string;
  channel: string;
  chatWidth: number;
  chatHeight: number;
  chatBgOpacity: number;
  chatFontFamily: string;
  chatFontSize: number;
  chatUsernameColor: string;
  chatStyle: string;
  chatCorner: string;
  chatInAnim: string;
  chatOutAnim: string;
  chatMsgTimeout: number;
}

function parseConfig(sp: URLSearchParams): OverlayConfig {
  return {
    accentColor:       sp.get('color')    ?? '#AC0747',
    duration:          Math.max(2, Number(sp.get('duration') ?? 5)),
    sound:             sp.get('sound')    === 'true',
    message:           sp.get('msg')      ?? '',
    channel:           sp.get('channel') ?? '',
    chatWidth:         Number(sp.get('w')       ?? 30),
    chatHeight:        Number(sp.get('h')       ?? 25),
    chatBgOpacity:     Number(sp.get('opacity') ?? 75),
    chatFontFamily:    sp.get('font')     ?? 'Geist',
    chatFontSize:      Number(sp.get('fsize')   ?? 15),
    chatUsernameColor: sp.get('ucolor')   ?? '',
    chatStyle:         sp.get('cstyle')   ?? 'contained',
    chatCorner:        sp.get('corner')   ?? 'bottom-left',
    chatInAnim:        sp.get('inanim')   ?? 'slide-left',
    chatOutAnim:       sp.get('outanim')  ?? 'fade-out',
    chatMsgTimeout:    Number(sp.get('msgttl') ?? 0),
  };
}

function useGoogleFont(family: string) {
  // Dynamically inject Google Fonts link if the family isn't the built-in Geist
  const BUILT_IN = ['Geist', 'Geist Mono', 'Bricolage Grotesque'];
  if (!BUILT_IN.includes(family)) {
    const id = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id   = id;
      link.rel  = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700&display=swap`;
      document.head.appendChild(link);
    }
  }
}

export function overlayTriggerKey(id: string) {
  return `maple_trigger_${id}`;
}

// ── Overlay animations ────────────────────────────────────────────────────────

const ALERT_ICONS: Record<string, string>  = { follow: '❤️', sub: '⭐', bits: '💎', raid: '⚡' };
const ALERT_LABELS: Record<string, string> = {
  follow: 'New follower',
  sub:    'New subscriber',
  bits:   'Bits cheer',
  raid:   'Incoming raid',
};

interface AlertData { user: string; amount: string; viewers: string; }

function AlertOverlay({ id, config, eventData }: { id: string; config: OverlayConfig; eventData?: AlertData }) {
  const u = eventData?.user    ?? 'ratking_99';
  const a = eventData?.amount  ?? '500';
  const v = eventData?.viewers ?? '42';
  const label = config.message
    .replace('{user}',    u)
    .replace('{amount}',  a)
    .replace('{viewers}', v);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 20,
          padding: '20px 32px',
          background: 'rgba(16,10,6,.93)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${config.accentColor}66`,
          borderRadius: 22,
          boxShadow: `0 0 70px -12px ${config.accentColor}99, 0 32px 64px -24px rgba(0,0,0,.7)`,
          animation: 'overlay-slide-up .45s var(--ease-bouncy)',
          maxWidth: 580,
        }}
      >
        <div
          style={{
            width: 68, height: 68, borderRadius: '50%', flexShrink: 0,
            background: config.accentColor,
            display: 'grid', placeItems: 'center', fontSize: 30,
            boxShadow: `0 8px 28px -4px ${config.accentColor}bb`,
          }}
        >
          {ALERT_ICONS[id] ?? '🍁'}
        </div>
        <div>
          <div
            style={{
              fontSize: 11, fontFamily: 'Geist Mono, monospace',
              color: config.accentColor,
              letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 5,
            }}
          >
            {ALERT_LABELS[id] ?? 'Alert'}
          </div>
          <div
            style={{
              fontSize: 24, fontWeight: 800, color: '#fff',
              fontFamily: 'Bricolage Grotesque, sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChatMessage { id: number; user: string; color: string; text: string; exiting?: boolean; }


const MAX_MSGS  = 12;
const EXIT_MS   = 300;
const IN_MS     = 260;

const IN_ANIM_MAP: Record<string, string> = {
  'slide-left':  'chat-in-left',
  'slide-right': 'chat-in-right',
  'slide-up':    'chat-in-up',
  'slide-down':  'chat-in-down',
  'fade':        'chat-in-fade',
  'pop':         'chat-in-pop',
};
const OUT_ANIM_MAP: Record<string, string> = {
  'exit-left':  'chat-out-left',
  'exit-right': 'chat-out-right',
  'exit-up':    'chat-out-up',
  'exit-down':  'chat-out-down',
  'fade-out':   'chat-out-fade',
  'pop-out':    'chat-out-pop',
};

function chatCornerStyle(corner: string): React.CSSProperties {
  const p = 12;
  if (corner === 'top-right')    return { top: p, right: p };
  if (corner === 'bottom-right') return { bottom: p, right: p };
  if (corner === 'top-left')     return { top: p, left: p };
  return                                { bottom: p, left: p };
}

function msgOpacity(idx: number, total: number, exiting?: boolean): number | undefined {
  if (exiting) return undefined; // CSS animation controls opacity during exit
  const rank = total - 1 - idx; // 0 = newest
  if (rank === 0) return 1;
  if (rank === 1) return 0.72;
  if (rank === 2) return 0.48;
  return 0.28;
}

function ChatOverlay({ config }: { config: OverlayConfig }) {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const exitTimers   = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const expireTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useGoogleFont(config.chatFontFamily);

  // Clear all timers on unmount
  useEffect(() => () => {
    exitTimers.current.forEach(clearTimeout);
    expireTimers.current.forEach(clearTimeout);
  }, []);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'exiting'>) => {
    const msgId = Date.now() + Math.random();
    const newMsg: ChatMessage = { ...msg, id: msgId };
    setMessages(prev => {
      const next = [...prev, newMsg];
      if (next.length <= MAX_MSGS) return next;
      const toExit = next.find(m => !m.exiting);
      if (!toExit) return next;
      return next.map(m => m.id === toExit.id ? { ...m, exiting: true } : m);
    });

    if (config.chatMsgTimeout > 0) {
      const t = setTimeout(() => {
        setMessages(prev => {
          const target = prev.find(m => m.id === msgId);
          if (!target || target.exiting) return prev;
          return prev.map(m => m.id === msgId ? { ...m, exiting: true } : m);
        });
        expireTimers.current.delete(msgId);
      }, config.chatMsgTimeout * 1000);
      expireTimers.current.set(msgId, t);
    }
  }, [config.chatMsgTimeout]);

  // Schedule DOM removal for messages marked exiting; cancel any pending expire timer
  useEffect(() => {
    messages.filter(m => m.exiting).forEach(m => {
      const expT = expireTimers.current.get(m.id);
      if (expT) { clearTimeout(expT); expireTimers.current.delete(m.id); }

      if (exitTimers.current.has(m.id)) return;
      const t = setTimeout(() => {
        setMessages(prev => prev.filter(x => x.id !== m.id));
        exitTimers.current.delete(m.id);
      }, EXIT_MS);
      exitTimers.current.set(m.id, t);
    });
  }, [messages]);

  // Real Twitch IRC
  useEffect(() => {
    if (!config.channel) return;
    const disconnect = connectTwitchChat(
      config.channel,
      (msg) => addMessage(msg),
      () => setConnected(true),
    );
    return disconnect;
  }, [config.channel, addMessage]);

  const bgAlpha      = (config.chatBgOpacity / 100).toFixed(2);
  const font         = `${config.chatFontFamily}, sans-serif`;
  const fsize        = config.chatFontSize;
  const inAnimName   = IN_ANIM_MAP[config.chatInAnim]   ?? 'chat-in-left';
  const outAnimName  = OUT_ANIM_MAP[config.chatOutAnim]  ?? 'chat-out-fade';
  const isContained  = config.chatStyle !== 'cards';
  const posStyle     = chatCornerStyle(config.chatCorner);

  const msgAnim = (m: ChatMessage) =>
    m.exiting
      ? `${outAnimName} ${EXIT_MS}ms var(--ease-in) forwards`
      : `${inAnimName} ${IN_MS}ms var(--ease-out)`;

  return (
    <div
      style={{
        position: 'fixed',
        ...posStyle,
        width:     `${config.chatWidth}vw`,
        maxHeight: `${config.chatHeight}vh`,
        display:   'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        gap: isContained ? 0 : 4,
        ...(isContained ? {
          background:  `rgba(8,5,3,${bgAlpha})`,
          borderRadius: 12,
          padding:     '10px 12px',
          boxSizing:   'border-box' as const,
        } : {}),
      }}
    >
      {config.channel && !connected && (
        <div style={{ padding: '3px 0', fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,.3)', letterSpacing: '.08em' }}>
          connecting to #{config.channel}…
        </div>
      )}

      {messages.map((m, i) => (
        <div
          key={m.id}
          style={{
            fontFamily:   font,
            fontSize:     fsize,
            lineHeight:   1.6,
            color:        'rgba(255,255,255,.92)',
            animation:    msgAnim(m),
            opacity:      msgOpacity(i, messages.length, m.exiting),
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            flexShrink:   0,
            ...(isContained ? {
              padding: '3px 0',
            } : {
              padding:    '4px 12px 4px 10px',
              background: `rgba(8,5,3,${bgAlpha})`,
              borderLeft: `3px solid ${config.accentColor}66`,
              borderRadius: '0 6px 6px 0',
            }),
          }}
        >
          <span style={{ color: config.chatUsernameColor || m.color, fontWeight: 700 }}>
            {m.user}
          </span>
          <span style={{ color: 'rgba(255,255,255,.3)' }}>: </span>
          {m.text}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverlaySource() {
  const { id = '' }     = useParams<{ id: string }>();
  const [searchParams]  = useSearchParams();
  const config          = parseConfig(searchParams);

  const [playing, setPlaying]     = useState(false);
  const [alertData, setAlertData] = useState<AlertData | undefined>(undefined);

  // Transparent background for OBS browser source
  useEffect(() => {
    const prevBodyBg  = document.body.style.background;
    const prevHtmlBg  = document.documentElement.style.background;
    const prevOverflow = document.body.style.overflow;
    const root = document.getElementById('root');
    const prevRootBg = root?.style.background ?? '';
    document.body.style.background           = 'transparent';
    document.documentElement.style.background = 'transparent';
    document.body.style.overflow             = 'hidden';
    if (root) root.style.background          = 'transparent';
    return () => {
      document.body.style.background           = prevBodyBg;
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.overflow             = prevOverflow;
      if (root) root.style.background          = prevRootBg;
    };
  }, []);

  const isChat       = id === 'chat';
  const isNowPlaying = id === 'nowplaying';

  const trigger = useCallback(() => {
    if (isChat) {
      setPlaying(prev => {
        if (!prev && config.sound) playOverlaySound(id);
        return !prev;
      });
      return;
    }
    setPlaying(prev => {
      if (prev) return prev;
      if (config.sound) playOverlaySound(id);
      return true;
    });
  }, [id, isChat, config.sound]);

  // Auto-dismiss alert after duration (not for Chat which is persistent)
  useEffect(() => {
    if (!playing || isChat) return;
    const t = setTimeout(() => setPlaying(false), config.duration * 1000);
    return () => clearTimeout(t);
  }, [playing, isChat, config.duration]);

  // Stable ref so the storage listener always calls the latest trigger
  const triggerRef = useRef(trigger);
  useEffect(() => { triggerRef.current = trigger; }, [trigger]);

  // Listen for triggers from the editor (or any other tab)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === overlayTriggerKey(id) && e.newValue) {
        triggerRef.current();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [id]);

  // Real Twitch EventSub — fires the overlay on actual follows/subs/bits/raids.
  // Credentials are in the URL fragment (#token=...&uid=...) so OBS browser sources
  // (separate localStorage) can connect. Fragments are never sent to servers.
  useEffect(() => {
    if (isChat || isNowPlaying) return;
    // Read from fragment — not sent to servers, safe for credentials
    const frag  = new URLSearchParams(window.location.hash.slice(1));
    let token   = frag.get('token') ?? '';
    let uid     = frag.get('uid')   ?? '';
    if (!token || !uid) {
      // Fallback: same-browser tab opened from the dashboard
      token = localStorage.getItem('twitch_access_token') ?? '';
      try {
        uid = (JSON.parse(localStorage.getItem('twitch_user') ?? '{}') as { id?: string }).id ?? '';
      } catch { /* ignore */ }
    }
    if (!token || !uid) return;
    const disconnect = connectEventSub(id, token, uid, (event) => {
      const data = extractAlertData(id, event.data);
      setAlertData(data);
      triggerRef.current();
    });
    return disconnect;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isChat]);

  // Chat box is always-on in OBS — show immediately on load
  useEffect(() => {
    if (isChat) setPlaying(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-play if ?autoplay=1 (useful for quick testing of alert overlays)
  const hasAutoplay = searchParams.get('autoplay') === '1';
  useEffect(() => {
    if (!hasAutoplay || isChat || isNowPlaying) return;
    const t = setTimeout(() => triggerRef.current(), 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {isNowPlaying && <NowPlayingOverlay />}
      {!isNowPlaying && playing && isChat  && <ChatOverlay config={config} />}
      {!isNowPlaying && playing && !isChat && <AlertOverlay id={id} config={config} eventData={alertData} />}
    </>
  );
}
