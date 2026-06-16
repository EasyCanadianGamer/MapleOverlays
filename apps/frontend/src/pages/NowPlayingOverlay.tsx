import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NowPlayingConfig {
  user:      string;
  channel:   string;
  duration:  number;
  corner:    'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  from:      'left' | 'right';
  color:     string;
  font:      string;
  fontColor: string;
  style:     'glass' | 'dark' | 'stripe';
  poll:      number;
}

interface TrackData {
  isPlaying: boolean;
  track?:    string;
  artist?:   string;
  album?:    string;
  albumArt?: string;
}

type AnimState = 'hidden' | 'entering' | 'visible' | 'exiting';

// ── Constants ─────────────────────────────────────────────────────────────────

const ENTER_MS   = 1100;
const EXIT_MS    = 850;
const TEXT_DELAY = 420;

// ── Config parsing ────────────────────────────────────────────────────────────

function parseConfig(sp: URLSearchParams): NowPlayingConfig {
  const corner    = (sp.get('corner') ?? 'bottom-left') as NowPlayingConfig['corner'];
  const fromParam = sp.get('from');
  const autoFrom: 'left' | 'right' = corner.includes('right') ? 'right' : 'left';
  const styleParam = sp.get('style');
  return {
    user:      sp.get('user')    ?? '',
    channel:   sp.get('channel') ?? '',
    duration:  Number(sp.get('duration') ?? 10),
    corner,
    from:      (fromParam === 'left' || fromParam === 'right') ? fromParam : autoFrom,
    color:     sp.get('color')  ?? '#AC0747',
    font:      sp.get('font')   ?? 'Geist',
    fontColor: sp.get('fcolor') ?? '#ffffff',
    style:     (styleParam === 'dark' || styleParam === 'stripe') ? styleParam : 'glass',
    poll:      Math.max(10, Number(sp.get('poll') ?? 15)),
  };
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function cornerStyle(corner: NowPlayingConfig['corner']): React.CSSProperties {
  const p = 20;
  if (corner === 'top-left')     return { top: p, left: p };
  if (corner === 'top-right')    return { top: p, right: p };
  if (corner === 'bottom-right') return { bottom: p, right: p };
  return                                { bottom: p, left: p };
}

function cardStyle(style: NowPlayingConfig['style'], color: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'stretch', width: 300, overflow: 'hidden',
  };
  if (style === 'dark') return {
    ...base, borderRadius: 10,
    background: 'rgba(12,8,6,0.92)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  };
  if (style === 'stripe') return {
    ...base, borderRadius: '0 10px 10px 0',
    background: 'rgba(10,7,5,0.88)',
    borderLeft: `3px solid ${color}`,
  };
  return {
    ...base, borderRadius: 10,
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.22)',
  };
}

// ── Google Font loader ────────────────────────────────────────────────────────

const BUILT_IN_FONTS = ['Geist', 'Geist Mono', 'Bricolage Grotesque'];

function useGoogleFont(family: string) {
  useEffect(() => {
    if (BUILT_IN_FONTS.includes(family)) return;
    const id = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id   = id;
    link.rel  = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NowPlayingOverlay() {
  const [searchParams] = useSearchParams();
  const config = useMemo(() => parseConfig(searchParams), [searchParams]);

  const [animState, setAnimState] = useState<AnimState>('hidden');
  const [track, setTrack]         = useState<TrackData | null>(null);
  const lastTrackRef  = useRef('');
  const dismissTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useGoogleFont(config.font);

  const show = useCallback((data: TrackData) => {
    if (dismissTimer.current)  clearTimeout(dismissTimer.current);
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    if (exitTimerRef.current)  clearTimeout(exitTimerRef.current);
    setTrack(data);
    setAnimState('entering');
    enterTimerRef.current = setTimeout(() => setAnimState('visible'), ENTER_MS + 50);
    dismissTimer.current = setTimeout(() => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      setAnimState('exiting');
      exitTimerRef.current = setTimeout(() => setAnimState('hidden'), EXIT_MS + 50);
    }, ENTER_MS + 50 + config.duration * 1000);
  }, [config.duration]);

  const hide = useCallback(() => {
    if (dismissTimer.current)  clearTimeout(dismissTimer.current);
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    if (exitTimerRef.current)  clearTimeout(exitTimerRef.current);
    setAnimState('exiting');
    exitTimerRef.current = setTimeout(() => setAnimState('hidden'), EXIT_MS + 50);
  }, []);

  const apiBase = (import.meta.env.VITE_API_URL as string) ?? '';

  // Shared poll function — also called on !song trigger
  const pollLastFm = useCallback(async (force = false) => {
    if (!config.user) return;
    try {
      const res = await fetch(`${apiBase}/nowplaying/json?user=${encodeURIComponent(config.user)}`);
      if (!res.ok) return;
      const data = await res.json() as TrackData;
      const key  = data.isPlaying ? `${data.track ?? ''}||${data.artist ?? ''}` : '';
      if (data.isPlaying && (force || key !== lastTrackRef.current)) {
        lastTrackRef.current = key;
        show(data);
      } else if (!data.isPlaying && lastTrackRef.current) {
        lastTrackRef.current = '';
        hide();
      }
    } catch { /* silent */ }
  }, [config.user, apiBase, show, hide]);

  // Regular polling loop
  useEffect(() => {
    if (!config.user) return;
    pollLastFm();
    const interval = setInterval(pollLastFm, config.poll * 1000);
    return () => {
      clearInterval(interval);
      if (dismissTimer.current)  clearTimeout(dismissTimer.current);
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (exitTimerRef.current)  clearTimeout(exitTimerRef.current);
    };
  }, [config.user, config.poll, pollLastFm]);

  // !song trigger — polls /nowplaying/triggered every 5s, force-shows on new timestamp
  useEffect(() => {
    if (!config.channel) return;
    let lastSeen: string | null = null;
    async function checkTrigger() {
      try {
        const res = await fetch(`${apiBase}/nowplaying/triggered?channel=${encodeURIComponent(config.channel)}`);
        if (!res.ok) return;
        const { triggered_at } = await res.json() as { triggered_at: string | null };
        if (triggered_at && triggered_at !== lastSeen) {
          lastSeen = triggered_at;
          pollLastFm(true);
        }
      } catch { /* silent */ }
    }
    checkTrigger();
    const interval = setInterval(checkTrigger, 5000);
    return () => clearInterval(interval);
  }, [config.channel, apiBase, pollLastFm]);

  // autoplay=1 — shows a mock track 600ms after mount for preview
  useEffect(() => {
    if (searchParams.get('autoplay') !== '1') return;
    const t = setTimeout(() => show({
      isPlaying: true,
      track:     'Blinding Lights',
      artist:    'The Weeknd',
      album:     'After Hours',
      albumArt:  '',
    }), 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (animState === 'hidden' || !track) return null;

  const fromLeft  = config.from === 'left';
  const enterAnim = fromLeft ? 'np-card-enter-left' : 'np-card-enter-right';
  const exitAnim  = fromLeft ? 'np-card-exit-right' : 'np-card-exit-left';
  const textAnim  = fromLeft ? 'np-text-reveal-left' : 'np-text-reveal-right';

  const wrapAnim: React.CSSProperties =
    animState === 'entering' ? { animation: `${enterAnim} ${ENTER_MS}ms cubic-bezier(0.22,1,0.36,1) forwards` } :
    animState === 'exiting'  ? { animation: `${exitAnim} ${EXIT_MS}ms cubic-bezier(0.55,0,1,0.45) forwards` } :
    { transform: 'translateX(0)', opacity: 1 };

  const artPopAnim: React.CSSProperties = animState === 'entering'
    ? { animation: `np-art-pop ${ENTER_MS}ms cubic-bezier(0.34,1.56,0.64,1) forwards` }
    : {};

  const textRevealAnim: React.CSSProperties = animState === 'entering'
    ? { animation: `${textAnim} 0.55s cubic-bezier(0.22,1,0.36,1) ${TEXT_DELAY}ms both` }
    : {};

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', ...cornerStyle(config.corner) }}>
        <div style={{ ...cardStyle(config.style, config.color), ...wrapAnim }}>

          {/* Album art */}
          <div style={{
            width: 72, height: 72, flexShrink: 0,
            background: track.albumArt
              ? undefined
              : `linear-gradient(135deg, ${config.color}cc, ${config.color}44)`,
            ...artPopAnim,
          }}>
            {track.albumArt
              ? <img src={track.albumArt} alt={track.album} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 26 }}>🎵</div>
            }
          </div>

          {/* Track info */}
          <div style={{
            padding: '12px 14px', flex: 1, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3,
            fontFamily: `${config.font}, sans-serif`,
            ...textRevealAnim,
          }}>
            <div style={{ fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: config.color, fontWeight: 600 }}>
              Now Playing
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: config.fontColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {track.track}
            </div>
            <div style={{ fontSize: 11, color: config.fontColor, opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {track.artist}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
