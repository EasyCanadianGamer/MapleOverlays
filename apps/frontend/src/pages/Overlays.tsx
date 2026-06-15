import { useState, useEffect, useRef } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Toggle from '../components/ui/Toggle';
import Icon from '../components/ui/Icon';
import { playOverlaySound } from '../lib/sounds';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverlayItem {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: string;
}

interface OverlayConfig {
  accentColor: string;
  duration: number;
  sound: boolean;
  message: string;
  // Chat box settings
  chatWidth?: number;
  chatHeight?: number;
  chatBgOpacity?: number;
  chatFontFamily?: string;
  chatFontSize?: number;
  chatUsernameColor?: string;
  chatStyle?: 'contained' | 'cards';
  chatCorner?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  chatInAnim?: string;
  chatOutAnim?: string;
  chatMsgTimeout?: number;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const OVERLAYS: OverlayItem[] = [
  { id: 'follow', name: 'Follow alert',     desc: 'Slide-in card with confetti',          color: '#C12F5D', icon: 'heart' },
  { id: 'sub',    name: 'Subscriber alert', desc: 'Big celebration with sound',           color: '#FFB627', icon: 'star'  },
  { id: 'bits',   name: 'Bits cheer',       desc: 'Animated counter, scales with amount', color: '#5BA8FF', icon: 'zap'   },
  { id: 'raid',   name: 'Raid welcome',     desc: 'Incoming raider parade',               color: '#22C58B', icon: 'users' },
  { id: 'chat',   name: 'Chat box',          desc: 'Animated chat overlay, any corner',    color: '#B7AAAE', icon: 'bot'   },
];

const DEFAULT_CONFIGS: Record<string, OverlayConfig> = {
  follow: { accentColor: '#C12F5D', duration: 5,  sound: true,  message: '{user} just followed!' },
  sub:    { accentColor: '#FFB627', duration: 7,  sound: true,  message: '{user} just subscribed!' },
  bits:   { accentColor: '#5BA8FF', duration: 5,  sound: true,  message: '{user} cheered {amount} bits!' },
  raid:   { accentColor: '#22C58B', duration: 8,  sound: true,  message: '{user} is raiding with {viewers} viewers!' },
  chat:   { accentColor: '#B7AAAE', duration: 30, sound: false, message: '', chatWidth: 30, chatHeight: 25, chatBgOpacity: 75, chatFontFamily: 'Geist', chatFontSize: 15, chatUsernameColor: '', chatStyle: 'contained', chatCorner: 'bottom-left', chatInAnim: 'slide-left', chatOutAnim: 'fade-out', chatMsgTimeout: 0 },
};

// Overlays that have a synthesised default sound
const SOUND_MAP_IDS = ['follow', 'sub', 'bits', 'raid'];

const STORAGE_KEY = 'maple_overlay_configs';

function loadConfigs(): Record<string, OverlayConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIGS, ...(JSON.parse(raw) as Record<string, OverlayConfig>) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIGS };
}

// Curated free fonts from Google Fonts (loaded on demand)
const CHAT_FONTS = [
  { label: 'Geist (default)',  value: 'Geist',           google: false },
  { label: 'Roboto',           value: 'Roboto',           google: true  },
  { label: 'Nunito',           value: 'Nunito',           google: true  },
  { label: 'Inter',            value: 'Inter',            google: true  },
  { label: 'JetBrains Mono',   value: 'JetBrains Mono',  google: true  },
  { label: 'Exo 2',            value: 'Exo 2',            google: true  },
  { label: 'Oswald',           value: 'Oswald',           google: true  },
  { label: 'Press Start 2P',   value: 'Press Start 2P',  google: true  },
];

function loadGoogleFont(family: string): void {
  const id = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

function buildOverlayUrl(id: string, config: OverlayConfig): string {
  const params = new URLSearchParams({
    color:    config.accentColor,
    duration: String(config.duration),
    sound:    String(config.sound),
    msg:      config.message,
  });

  if (id === 'chat') {
    try {
      const stored = JSON.parse(localStorage.getItem('twitch_user') ?? '{}') as { login?: string };
      if (stored.login) params.set('channel', stored.login);
    } catch { /* ignore */ }
    if (config.chatWidth != null) params.set('w', String(config.chatWidth));
    if (config.chatHeight != null) params.set('h', String(config.chatHeight));
    if (config.chatBgOpacity != null) params.set('opacity', String(config.chatBgOpacity));
    if (config.chatFontFamily) params.set('font', config.chatFontFamily);
    if (config.chatFontSize != null) params.set('fsize', String(config.chatFontSize));
    if (config.chatUsernameColor) params.set('ucolor', config.chatUsernameColor);
    params.set('cstyle', config.chatStyle  ?? 'contained');
    params.set('corner', config.chatCorner ?? 'bottom-left');
    params.set('inanim', config.chatInAnim ?? 'slide-left');
    params.set('outanim', config.chatOutAnim ?? 'fade-out');
    if ((config.chatMsgTimeout ?? 0) > 0) params.set('msgttl', String(config.chatMsgTimeout));
  }

  // Alert overlays embed token + uid so OBS browser sources (which have separate
  // localStorage) can connect to EventSub. Using a fragment (#) keeps credentials
  // out of server logs and referrer headers — fragments are never sent to servers.
  let fragment = '';
  if (!['chat', 'brb'].includes(id)) {
    try {
      const token = localStorage.getItem('twitch_access_token');
      const user  = JSON.parse(localStorage.getItem('twitch_user') ?? '{}') as { id?: string };
      if (token && user.id) {
        const frag = new URLSearchParams();
        frag.set('token', token);
        frag.set('uid', user.id);
        fragment = frag.toString();
      }
    } catch { /* ignore */ }
  }

  const base = `${window.location.origin}/overlays/${id}?${params}`;
  return fragment ? `${base}#${fragment}` : base;
}

// ── Shared chip ───────────────────────────────────────────────────────────────

function CopyUrlChip({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px',
      background: 'var(--bg-0)', borderRadius: 8,
      border: '1px solid var(--border-1)',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)',
    }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
      <button
        onClick={() => { void navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{ background: 'transparent', border: 0, color: copied ? '#22C58B' : 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', padding: 0, transition: 'color .12s var(--ease-out)' }}
      >
        <Icon name={copied ? 'check' : 'copy'} size={13} />
      </button>
    </div>
  );
}

// ── Preview components ────────────────────────────────────────────────────────

interface ChatMsg { id: number; user: string; color: string; text: string; }

const SAMPLE_CHAT = [
  { user: 'ratking_99',   color: '#5BA8FF', text: 'pog that was insane' },
  { user: 'lurking_loaf', color: '#FFB627', text: 'actually so hype rn' },
  { user: 'streamer_dad', color: '#C12F5D', text: "GGs let's gooo 🍁" },
  { user: 'maple_viewer', color: '#22C58B', text: 'this overlay is so clean' },
  { user: 'NightBot',     color: '#FF5470', text: '!commands for the bot list' },
  { user: 'chat_user_1',  color: '#B7AAAE', text: 'monkaS that was close' },
  { user: 'chat_user_2',  color: '#9B59B6', text: 'KEKW KEKW KEKW' },
];

function AlertPreview({ overlay, config, playing }: { overlay: OverlayItem; config: OverlayConfig; playing: boolean }) {
  const label = config.message
    .replace('{user}', 'ratking_99')
    .replace('{amount}', '500')
    .replace('{viewers}', '42');

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      {playing && (
        <>
          <div style={{ position: 'absolute', top: '28%', left: '44%', width: 8, height: 8, borderRadius: 2, background: config.accentColor, animation: 'overlay-confetti-1 .8s var(--ease-out) forwards' }} />
          <div style={{ position: 'absolute', top: '26%', left: '52%', width: 6, height: 6, borderRadius: 999, background: '#FFB627', animation: 'overlay-confetti-2 .9s .05s var(--ease-out) forwards' }} />
          <div style={{ position: 'absolute', top: '30%', left: '48%', width: 7, height: 7, borderRadius: 1, background: '#5BA8FF', animation: 'overlay-confetti-3 .75s .1s var(--ease-out) forwards' }} />
        </>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 22px',
        background: 'rgba(16,10,6,.92)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${config.accentColor}55`,
        borderRadius: 16,
        boxShadow: `0 0 50px -12px ${config.accentColor}88`,
        animation: playing ? 'overlay-slide-up .4s var(--ease-bouncy)' : 'none',
        maxWidth: '80%',
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: config.accentColor,
          display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: `0 4px 20px -4px ${config.accentColor}`,
        }}>
          <Icon name={overlay.icon} size={22} style={{ color: '#fff' }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: config.accentColor, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 3 }}>
            New {overlay.name.replace(' alert', '').replace(' welcome', '')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

const MAX_PREVIEW_MSGS = 5;

const CORNER_PREVIEW: Record<string, React.CSSProperties> = {
  'top-left':     { top: 6, left: 6 },
  'top-right':    { top: 6, right: 6 },
  'bottom-left':  { bottom: 6, left: 6 },
  'bottom-right': { bottom: 6, right: 6 },
};

const IN_ANIM_PREVIEW: Record<string, string> = {
  'slide-left':  'chat-in-left',
  'slide-right': 'chat-in-right',
  'slide-up':    'chat-in-up',
  'slide-down':  'chat-in-down',
  'fade':        'chat-in-fade',
  'pop':         'chat-in-pop',
};

function ChatPreview({ config, playing }: { config: OverlayConfig; playing: boolean }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!playing) { setMessages([]); indexRef.current = 0; return; }
    const add = () => {
      const src = SAMPLE_CHAT[indexRef.current % SAMPLE_CHAT.length]!;
      indexRef.current++;
      setMessages(prev => {
        const next = [...prev, { ...src, id: Date.now() + indexRef.current }];
        return next.length > MAX_PREVIEW_MSGS ? next.slice(-MAX_PREVIEW_MSGS) : next;
      });
    };
    add();
    const t = setInterval(add, 1400);
    return () => clearInterval(t);
  }, [playing]);

  const bgAlpha      = ((config.chatBgOpacity ?? 75) / 100).toFixed(2);
  const font         = `${config.chatFontFamily ?? 'Geist'}, sans-serif`;
  const fsize        = Math.round((config.chatFontSize ?? 15) * 0.68);
  const widthPct     = config.chatWidth ?? 30;
  const ucolor       = config.chatUsernameColor ?? '';
  const corner       = config.chatCorner ?? 'bottom-left';
  const isContained  = (config.chatStyle ?? 'contained') !== 'cards';
  const cornerPos    = CORNER_PREVIEW[corner] ?? { bottom: 6, left: 6 };
  const inAnim       = IN_ANIM_PREVIEW[config.chatInAnim ?? 'slide-left'] ?? 'chat-in-left';

  if (!playing && messages.length === 0) {
    return (
      <div style={{
        position: 'absolute', ...cornerPos,
        width: `${widthPct}%`,
        padding: '6px 10px',
        background: 'rgba(10,6,4,.35)',
        borderRadius: isContained ? 6 : 0,
        borderLeft: isContained ? 'none' : `2px solid ${config.accentColor}44`,
      }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,.28)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          chat box · press play
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', ...cornerPos,
      width: `${widthPct}%`,
      maxHeight: `${config.chatHeight ?? 25}%`,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      overflow: 'hidden',
      gap: isContained ? 0 : 2,
      ...(isContained ? {
        background: `rgba(8,5,3,${bgAlpha})`,
        borderRadius: 6,
        padding: '5px 7px',
        boxSizing: 'border-box' as const,
      } : {}),
    }}>
      {messages.map((m, i) => (
        <div
          key={m.id}
          style={{
            fontFamily: font,
            fontSize: fsize,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,.9)',
            animation: `${inAnim} .22s var(--ease-out)`,
            opacity: isContained
              ? (messages.length - 1 - i === 0 ? 1 : messages.length - 1 - i === 1 ? 0.7 : 0.4)
              : 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            ...(isContained ? {
              padding: '2px 0',
            } : {
              padding: '3px 8px 3px 6px',
              background: `rgba(8,5,3,${bgAlpha})`,
              borderLeft: `2px solid ${config.accentColor}55`,
              borderRadius: '0 4px 4px 0',
            }),
          }}
        >
          <span style={{ color: ucolor || m.color, fontWeight: 700 }}>{m.user}</span>
          <span style={{ color: 'rgba(255,255,255,.3)' }}>: </span>
          {m.text}
        </div>
      ))}
    </div>
  );
}


function OverlayPreview({ overlay, config, playing }: { overlay: OverlayItem; config: OverlayConfig; playing: boolean }) {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '16/9',
      background: '#0a0604',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid var(--border-1)',
    }}>
      {/* Grid lines like OBS output */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {overlay.id === 'chat' && <ChatPreview config={config} playing={playing} />}
      {overlay.id !== 'chat' && <AlertPreview overlay={overlay} config={config} playing={playing} />}
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: 40, padding: '0 14px', borderRadius: 10,
  background: 'var(--bg-1)', border: '1px solid var(--border-2)',
  color: 'var(--ink-0)', outline: 'none',
  fontFamily: 'var(--font-body)', fontSize: 14,
  width: '100%', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--ink-2)', fontWeight: 500,
};

function OverlayEditor({
  overlay,
  config,
  onConfigChange,
  onBack,
}: {
  overlay: OverlayItem;
  config: OverlayConfig;
  onConfigChange: (c: OverlayConfig) => void;
  onBack: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    };
  }, []);

  const url = buildOverlayUrl(overlay.id, config);
  const isAlert = overlay.id !== 'chat';

  const playPreview = () => {
    setPlaying(true);
    if (config.sound) playOverlaySound(overlay.id);
    localStorage.setItem(`maple_trigger_${overlay.id}`, Date.now().toString());
    const ms = overlay.id === 'brb' ? 3000 : Math.max(config.duration * 1000, 1500);
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    playTimeoutRef.current = setTimeout(() => setPlaying(false), ms);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 14px', borderRadius: 10,
            border: '1px solid var(--border-2)', background: 'var(--bg-2)',
            color: 'var(--ink-1)', fontFamily: 'var(--font-body)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
          Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `${overlay.color}22`, border: `1px solid ${overlay.color}44`,
            display: 'grid', placeItems: 'center', color: overlay.color,
          }}>
            <Icon name={overlay.icon} size={16} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: 'var(--ink-0)', lineHeight: 1.1 }}>
              {overlay.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{overlay.desc}</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ maxWidth: 340 }}>
          <CopyUrlChip url={url} />
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <OverlayPreview overlay={overlay} config={config} playing={playing} />
          <Button
            variant="secondary"
            icon="play"
            onClick={playPreview}
            disabled={playing}
            style={{ alignSelf: 'flex-start' }}
          >
            {playing ? 'Playing…' : 'Play preview'}
          </Button>
        </div>

        {/* Settings */}
        <Card style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Eyebrow>Customise</Eyebrow>

          {/* Accent colour */}
          <div style={labelStyle}>
            <span style={labelTextStyle}>Accent colour</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={config.accentColor}
                onChange={e => onConfigChange({ ...config, accentColor: e.target.value })}
                style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border-2)', padding: 4, background: 'var(--bg-1)', cursor: 'pointer' }}
              />
              <code style={{ fontSize: 13, color: 'var(--ink-1)' }}>{config.accentColor}</code>
            </div>
          </div>

          {/* Duration — not for BRB */}
          {overlay.id !== 'brb' && (
            <div style={labelStyle}>
              <span style={labelTextStyle}>Duration — {config.duration}s</span>
              <input
                type="range"
                min={2} max={15} step={1}
                value={config.duration}
                onChange={e => onConfigChange({ ...config, duration: Number(e.target.value) })}
                style={{ accentColor: config.accentColor, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                <span>2s</span><span>15s</span>
              </div>
            </div>
          )}

          {/* Sound */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Toggle on={config.sound} onChange={v => onConfigChange({ ...config, sound: v })} />
              <span style={{ fontSize: 13, color: 'var(--ink-1)', flex: 1 }}>Play sound</span>
              {SOUND_MAP_IDS.includes(overlay.id) && (
                <button
                  onClick={() => playOverlaySound(overlay.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    height: 28, padding: '0 10px', borderRadius: 8,
                    border: '1px solid var(--border-2)', background: 'var(--bg-3)',
                    color: 'var(--ink-2)', cursor: 'pointer',
                    fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600,
                  }}
                >
                  <Icon name="play" size={11} />
                  Test
                </button>
              )}
            </div>
            {SOUND_MAP_IDS.includes(overlay.id) && (
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', paddingLeft: 2 }}>
                Default synth tone · custom sounds coming later
              </div>
            )}
          </div>

          {/* Chat box settings */}
          {overlay.id === 'chat' && (
            <>
              {/* Corner / position */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Position</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: 116 }}>
                  {(['top-left','top-right','bottom-left','bottom-right'] as const).map(corner => {
                    const active = (config.chatCorner ?? 'bottom-left') === corner;
                    const arrows: Record<string, string> = { 'top-left': '↖', 'top-right': '↗', 'bottom-left': '↙', 'bottom-right': '↘' };
                    return (
                      <button
                        key={corner}
                        onClick={() => onConfigChange({ ...config, chatCorner: corner })}
                        style={{
                          height: 36, borderRadius: 8, fontSize: 18,
                          border: `1px solid ${active ? config.accentColor : 'var(--border-2)'}`,
                          background: active ? `${config.accentColor}22` : 'var(--bg-1)',
                          color: active ? config.accentColor : 'var(--ink-3)',
                          cursor: 'pointer',
                        }}
                      >
                        {arrows[corner]}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  Where the box sits on your canvas
                </div>
              </div>

              {/* Style */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Style</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['contained', 'cards'] as const).map(s => {
                    const active = (config.chatStyle ?? 'contained') === s;
                    return (
                      <button
                        key={s}
                        onClick={() => onConfigChange({ ...config, chatStyle: s })}
                        style={{
                          flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${active ? config.accentColor : 'var(--border-2)'}`,
                          background: active ? `${config.accentColor}22` : 'var(--bg-1)',
                          color: active ? config.accentColor : 'var(--ink-2)',
                          fontFamily: 'var(--font-body)', fontSize: 13,
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {s === 'contained' ? '■ Box' : '≡ Cards'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Enter animation */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Enter animation</span>
                <select
                  value={config.chatInAnim ?? 'slide-left'}
                  onChange={e => onConfigChange({ ...config, chatInAnim: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="slide-left">Slide from Left</option>
                  <option value="slide-right">Slide from Right</option>
                  <option value="slide-up">Slide Up</option>
                  <option value="slide-down">Slide Down</option>
                  <option value="fade">Fade In</option>
                  <option value="pop">Pop In</option>
                </select>
              </div>

              {/* Exit animation */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Exit animation</span>
                <select
                  value={config.chatOutAnim ?? 'fade-out'}
                  onChange={e => onConfigChange({ ...config, chatOutAnim: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="exit-left">Exit Left</option>
                  <option value="exit-right">Exit Right</option>
                  <option value="exit-up">Exit Up</option>
                  <option value="exit-down">Exit Down</option>
                  <option value="fade-out">Fade Out</option>
                  <option value="pop-out">Pop Out</option>
                </select>
              </div>

              {/* Message timeout */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>
                  Message timeout — {(config.chatMsgTimeout ?? 0) === 0 ? 'never' : `${config.chatMsgTimeout}s`}
                </span>
                <input
                  type="range" min={0} max={120} step={5}
                  value={config.chatMsgTimeout ?? 0}
                  onChange={e => onConfigChange({ ...config, chatMsgTimeout: Number(e.target.value) })}
                  style={{ accentColor: config.accentColor, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  <span>never</span><span>2 min</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  How long a message stays before the exit animation plays
                </div>
              </div>

              {/* Width */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Box width — {config.chatWidth ?? 30}%</span>
                <input
                  type="range" min={15} max={80} step={1}
                  value={config.chatWidth ?? 30}
                  onChange={e => onConfigChange({ ...config, chatWidth: Number(e.target.value) })}
                  style={{ accentColor: config.accentColor, cursor: 'pointer' }}
                />
              </div>

              {/* Height */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Box height — {config.chatHeight ?? 25}%</span>
                <input
                  type="range" min={10} max={60} step={1}
                  value={config.chatHeight ?? 25}
                  onChange={e => onConfigChange({ ...config, chatHeight: Number(e.target.value) })}
                  style={{ accentColor: config.accentColor, cursor: 'pointer' }}
                />
              </div>

              {/* Background opacity */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Background — {config.chatBgOpacity ?? 75}% opacity</span>
                <input
                  type="range" min={0} max={100} step={1}
                  value={config.chatBgOpacity ?? 75}
                  onChange={e => onConfigChange({ ...config, chatBgOpacity: Number(e.target.value) })}
                  style={{ accentColor: config.accentColor, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  <span>transparent</span><span>solid</span>
                </div>
              </div>

              {/* Font family */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Font</span>
                <select
                  value={config.chatFontFamily ?? 'Geist'}
                  onChange={e => {
                    const f = CHAT_FONTS.find(x => x.value === e.target.value);
                    if (f?.google) loadGoogleFont(f.value);
                    onConfigChange({ ...config, chatFontFamily: e.target.value });
                  }}
                  style={{
                    ...inputStyle, height: 40, padding: '0 14px',
                    fontFamily: `${config.chatFontFamily ?? 'Geist'}, sans-serif`,
                    cursor: 'pointer',
                  }}
                >
                  {CHAT_FONTS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Font size */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Font size — {config.chatFontSize ?? 15}px</span>
                <input
                  type="range" min={11} max={26} step={1}
                  value={config.chatFontSize ?? 15}
                  onChange={e => onConfigChange({ ...config, chatFontSize: Number(e.target.value) })}
                  style={{ accentColor: config.accentColor, cursor: 'pointer' }}
                />
              </div>

              {/* Username colour override */}
              <div style={labelStyle}>
                <span style={labelTextStyle}>Username colour</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="color"
                    value={config.chatUsernameColor || '#5BA8FF'}
                    onChange={e => onConfigChange({ ...config, chatUsernameColor: e.target.value })}
                    style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border-2)', padding: 4, background: 'var(--bg-1)', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <code style={{ fontSize: 12 }}>{config.chatUsernameColor || 'per-user'}</code>
                    {config.chatUsernameColor && (
                      <button
                        onClick={() => onConfigChange({ ...config, chatUsernameColor: '' })}
                        style={{ marginLeft: 8, background: 'none', border: 0, color: 'var(--ink-3)', cursor: 'pointer', fontSize: 11, padding: 0 }}
                      >
                        reset
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  Leave unset to use each viewer&apos;s Twitch color
                </div>
              </div>
            </>
          )}

          {/* Message — alerts only */}
          {isAlert ? (
            <label style={labelStyle}>
              <span style={labelTextStyle}>Alert message</span>
              <input
                value={config.message}
                onChange={e => onConfigChange({ ...config, message: e.target.value })}
                placeholder="Message text…"
                style={inputStyle}
              />
              {isAlert && (
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  {`{user}`} · {`{amount}`} · {`{viewers}`}
                </div>
              )}
            </label>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Overlays() {
  const [configs, setConfigs] = useState<Record<string, OverlayConfig>>(loadConfigs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const editingOverlay = OVERLAYS.find(o => o.id === editingId) ?? null;

  const updateConfig = (id: string, config: OverlayConfig) => {
    const next = { ...configs, [id]: config };
    setConfigs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  if (editingOverlay) {
    return (
      <OverlayEditor
        overlay={editingOverlay}
        config={configs[editingOverlay.id]!}
        onConfigChange={c => updateConfig(editingOverlay.id, c)}
        onBack={() => setEditingId(null)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Eyebrow>Overlays</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
            Browser sources.
          </h2>
          <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
            Drop these URLs into OBS or Streamlabs. They load in 80ms on a cold cache.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <Button variant="secondary" icon="plus" onClick={() => setShowComingSoon(true)}>
            New overlay
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {OVERLAYS.map(o => {
          const config = configs[o.id]!;
          return (
            <Card key={o.id} padded={false} style={{ overflow: 'hidden' }}>
              {/* Thumbnail */}
              <div
                style={{
                  aspectRatio: '16/9',
                  background: `${config.accentColor}1f`,
                  borderBottom: '1px solid var(--border-1)',
                  display: 'grid',
                  placeItems: 'center',
                  position: 'relative',
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: config.accentColor,
                  display: 'grid', placeItems: 'center',
                }}>
                  <Icon name={o.icon} size={24} style={{ color: '#fff' }} />
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', color: 'var(--ink-0)', flex: 1 }}>
                    {o.name}
                  </div>
                  <button
                    onClick={() => setEditingId(o.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      height: 28, padding: '0 10px', borderRadius: 8,
                      border: '1px solid var(--border-2)', background: 'var(--bg-3)',
                      color: 'var(--ink-2)', cursor: 'pointer',
                      fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600,
                    }}
                  >
                    <Icon name="settings" size={12} />
                    Edit
                  </button>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{o.desc}</div>
                <div style={{ marginTop: 10 }}>
                  <CopyUrlChip url={buildOverlayUrl(o.id, config)} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {showComingSoon && (
        <div
          onClick={() => setShowComingSoon(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.6)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border-2)',
              borderRadius: 20,
              padding: '40px 44px',
              maxWidth: 420,
              width: '90%',
              boxShadow: '0 32px 80px -20px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05) inset',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, var(--maple-600), var(--maple-400))',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 24px -8px var(--maple-500)',
            }}>
              <Icon name="sparkles" size={26} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink-0)' }}>
                Custom overlays in V2
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                Build fully custom overlays with your own layouts, widgets, and animations — like StreamElements or pixelchat, but yours.
              </div>
            </div>
            <div style={{
              background: 'var(--bg-3)', border: '1px solid var(--border-1)',
              borderRadius: 10, padding: '10px 16px',
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)',
            }}>
              Coming soon · stay tuned
            </div>
            <button
              onClick={() => setShowComingSoon(false)}
              style={{
                marginTop: 4, padding: '10px 28px', borderRadius: 10,
                background: 'var(--bg-3)', border: '1px solid var(--border-1)',
                color: 'var(--ink-1)', fontFamily: 'var(--font-body)', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
