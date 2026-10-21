import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShoutoutConfig {
  channel:  string;
  font:     string;
  color:    string;
  size:     number;
  duration: number;
}

interface ShoutoutData {
  triggered_at: string | null;
  target:       string | null;
  clip_url:     string | null;
  display_name: string | null;
  avatar_url:   string | null;
}

type AnimState = 'hidden' | 'entering' | 'visible' | 'exiting';

// ── Constants ─────────────────────────────────────────────────────────────────

const ENTER_MS = 600;
const EXIT_MS  = 500;
const POLL_MS  = 5000;

// ── Config parsing ────────────────────────────────────────────────────────────

function parseConfig(sp: URLSearchParams): ShoutoutConfig {
  return {
    channel:  sp.get('channel') ?? '',
    font:     sp.get('font')    ?? 'Geist',
    color:    sp.get('color')   ?? '#ffffff',
    size:     Number(sp.get('size') ?? 32),
    duration: Math.max(5, Number(sp.get('duration') ?? 12)),
  };
}

// ── Keyframes (injected once) ─────────────────────────────────────────────────

const SO_STYLES = `
@keyframes so-enter {
  from { opacity: 0; transform: translateY(32px) scale(.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1);   }
}
@keyframes so-exit {
  from { opacity: 1; transform: translateY(0)    scale(1);   }
  to   { opacity: 0; transform: translateY(16px) scale(.97); }
}
@keyframes so-avatar-pop {
  0%   { transform: scale(.7); opacity: 0; }
  70%  { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes so-label-in {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
`;

function injectStyles() {
  if (document.getElementById('so-styles')) return;
  const el = document.createElement('style');
  el.id = 'so-styles';
  el.textContent = SO_STYLES;
  document.head.appendChild(el);
}

// ── Google Font loader ────────────────────────────────────────────────────────

const BUILT_IN = ['Geist', 'Geist Mono', 'Bricolage Grotesque'];

function useGoogleFont(family: string) {
  useEffect(() => {
    if (BUILT_IN.includes(family)) return;
    const id = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id   = id;
    link.rel  = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700;900&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

// ── Clip URL validation ──────────────────────────────────────────────────────
// clip_url comes from GET /shoutout/triggered, a public unauthenticated endpoint.
// It's a direct signed MP4 URL (see getClipDownloadUrl in apps/bot/src/twitch.js) —
// Twitch's own clips.twitch.tv embed player actively resists unmuted autoplay on
// third-party domains even via its official JS SDK, so the bot instead resolves
// the clip's raw video file and this renders it in a plain <video>, which isn't
// subject to that embed-specific policy. Validated defensively before use.

function isSafeClipVideoUrl(clipUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(clipUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  // Twitch actually serves clip video files off CloudFront (e.g. *.cloudfront.net),
  // not a twitch.tv/twitchcdn.net subdomain — confirmed against a live clip response.
  return url.hostname === 'twitch.tv' || url.hostname.endsWith('.twitch.tv')
      || url.hostname === 'twitchcdn.net' || url.hostname.endsWith('.twitchcdn.net')
      || url.hostname === 'cloudfront.net' || url.hostname.endsWith('.cloudfront.net');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShoutoutOverlay() {
  const [sp]                 = useSearchParams();
  const config               = parseConfig(sp);
  const apiBase              = import.meta.env.VITE_API_URL ?? '';

  const [anim, setAnim]      = useState<AnimState>('hidden');
  const [data, setData]      = useState<ShoutoutData | null>(null);
  const lastSeenRef          = useRef<string | null>(null);
  const visTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);

  useGoogleFont(config.font);

  useEffect(() => { injectStyles(); }, []);

  const show = useCallback((d: ShoutoutData) => {
    if (visTimerRef.current) clearTimeout(visTimerRef.current);
    setData(d);
    setAnim('entering');
    setTimeout(() => setAnim('visible'), ENTER_MS);
    visTimerRef.current = setTimeout(() => {
      setAnim('exiting');
      setTimeout(() => setAnim('hidden'), EXIT_MS);
    }, (config.duration * 1000) + ENTER_MS);
  }, [config.duration]);

  // Poll for new shoutout triggers
  useEffect(() => {
    if (!config.channel) return;

    async function check() {
      try {
        const res = await fetch(
          `${apiBase}/shoutout/triggered?channel=${encodeURIComponent(config.channel)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const d = await res.json() as ShoutoutData;
        if (d.triggered_at && d.triggered_at !== lastSeenRef.current) {
          lastSeenRef.current = d.triggered_at;
          show(d);
        }
      } catch { /* silent */ }
    }

    check();
    const t = setInterval(check, POLL_MS);
    return () => clearInterval(t);
  }, [config.channel, apiBase, show]);


  if (anim === 'hidden') return null;

  const isEntering = anim === 'entering';
  const isExiting  = anim === 'exiting';
  const animation  = isEntering
    ? `so-enter ${ENTER_MS}ms cubic-bezier(.22,.68,0,1.2) forwards`
    : isExiting
      ? `so-exit ${EXIT_MS}ms ease-in forwards`
      : 'none';

  const font = `${config.font}, sans-serif`;
  const clipUrl = data?.clip_url && isSafeClipVideoUrl(data.clip_url) ? data.clip_url : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          animation,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           16,
          maxWidth:      560,
          width:         '100%',
        }}
      >
        {/* Clip embed */}
        {clipUrl && (
          <div
            style={{
              width:        '100%',
              borderRadius: 16,
              overflow:     'hidden',
              boxShadow:    '0 24px 64px -16px rgba(0,0,0,.8)',
              background:   '#000',
              aspectRatio:  '16/9',
            }}
          >
            <video
              key={data?.triggered_at ?? clipUrl}
              src={clipUrl}
              autoPlay
              muted={false}
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        {/* Name card */}
        <div
          style={{
            display:       'flex',
            alignItems:    'center',
            gap:           14,
            padding:       '14px 22px',
            background:    'rgba(10,6,4,.82)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderRadius:  14,
            boxShadow:     '0 8px 32px -8px rgba(0,0,0,.6)',
            width:         '100%',
            boxSizing:     'border-box' as const,
          }}
        >
          {data?.avatar_url && (
            <img
              src={data.avatar_url}
              alt=""
              style={{
                width:        52,
                height:       52,
                borderRadius: '50%',
                flexShrink:   0,
                animation:    `so-avatar-pop ${ENTER_MS}ms cubic-bezier(.22,.68,0,1.2) forwards`,
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize:      10,
                fontFamily:    'Geist Mono, monospace',
                letterSpacing: '.18em',
                textTransform: 'uppercase',
                color:         'rgba(255,255,255,.45)',
                marginBottom:  3,
                animation:     `so-label-in 400ms 200ms ease both`,
              }}
            >
              Go check out
            </div>
            <div
              style={{
                fontFamily:   font,
                fontSize:     config.size,
                fontWeight:   900,
                color:        config.color,
                lineHeight:   1.1,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                animation:    `so-label-in 450ms 300ms ease both`,
              }}
            >
              {data?.display_name ?? data?.target ?? ''}
            </div>
            <div
              style={{
                fontSize:   12,
                fontFamily: 'Geist Mono, monospace',
                color:      'rgba(255,255,255,.35)',
                marginTop:  3,
                animation:  `so-label-in 450ms 420ms ease both`,
              }}
            >
              twitch.tv/{data?.target ?? ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
