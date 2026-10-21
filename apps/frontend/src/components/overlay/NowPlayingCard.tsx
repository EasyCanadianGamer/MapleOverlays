import type { CSSProperties } from 'react';
import { cssFamily } from '../../lib/fontRef';
import CoverArt from './CoverArt';
import type { Corner, NpConfig, NpSize } from '../../lib/nowPlaying';

export interface TrackData {
  isPlaying: boolean;
  track?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
}
export type AnimState = 'hidden' | 'entering' | 'visible' | 'exiting';

export const ENTER_MS = 1100;
export const EXIT_MS = 850;
const TEXT_DELAY = 420;

const SIZE_SCALE: Record<NpSize, number> = { sm: 0.8, md: 1, lg: 1.25 };

function cornerStyle(corner: Corner): CSSProperties {
  const p = 20;
  if (corner === 'top-left') return { top: p, left: p };
  if (corner === 'top-right') return { top: p, right: p };
  if (corner === 'bottom-right') return { bottom: p, right: p };
  return { bottom: p, left: p };
}

function legacyCardStyle(style: 'glass' | 'dark' | 'stripe', color: string): CSSProperties {
  const base: CSSProperties = { display: 'flex', alignItems: 'stretch', width: 300, overflow: 'hidden' };
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

function customCardStyle(cfg: NpConfig, k: number): CSSProperties {
  return {
    display: 'flex', alignItems: 'stretch', width: 300 * k, overflow: 'hidden',
    borderRadius: cfg.cornerRounding,
    background: cfg.transparentBackground ? 'transparent' : cfg.bgColor,
    boxShadow: cfg.shadowOpacity > 0 ? `0 8px 32px rgba(0,0,0,${cfg.shadowOpacity / 100})` : 'none',
  };
}

export interface NowPlayingCardProps {
  cfg: NpConfig;
  track: TrackData;
  animState: AnimState;
}

export default function NowPlayingCard({ cfg, track, animState }: NowPlayingCardProps) {
  const custom = cfg.style === 'custom';
  const k = custom ? SIZE_SCALE[cfg.size] : 1;

  const fromLeft = cfg.from === 'left';
  const enterAnim = fromLeft ? 'np-card-enter-left' : 'np-card-enter-right';
  const exitAnim = fromLeft ? 'np-card-exit-right' : 'np-card-exit-left';
  const textAnim = fromLeft ? 'np-text-reveal-left' : 'np-text-reveal-right';

  const wrapAnim: CSSProperties =
    animState === 'entering' ? { animation: `${enterAnim} ${ENTER_MS}ms cubic-bezier(0.22,1,0.36,1) forwards` } :
    animState === 'exiting' ? { animation: `${exitAnim} ${EXIT_MS}ms cubic-bezier(0.55,0,1,0.45) forwards` } :
    { transform: 'translateX(0)', opacity: 1 };

  const artPopAnim: CSSProperties = animState === 'entering'
    ? { animation: `np-art-pop ${ENTER_MS}ms cubic-bezier(0.34,1.56,0.64,1) forwards` }
    : {};

  const textRevealAnim: CSSProperties = animState === 'entering'
    ? { animation: `${textAnim} 0.55s cubic-bezier(0.22,1,0.36,1) ${TEXT_DELAY}ms both` }
    : {};

  const card = cfg.style === 'custom' ? customCardStyle(cfg, k) : legacyCardStyle(cfg.style, cfg.accent);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', ...cornerStyle(cfg.corner) }}>
        <div style={{ ...card, ...wrapAnim }}>

          {/* Album art */}
          <div style={{
            width: 72 * k, height: 72 * k, flexShrink: 0,
            background: `linear-gradient(135deg, ${cfg.accent}cc, ${cfg.accent}44)`,
            ...artPopAnim,
          }}>
            <CoverArt url={track.albumArt} emojiSize={26 * k} />
          </div>

          {/* Track info */}
          <div style={{
            padding: `${12 * k}px ${14 * k}px`, flex: 1, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 * k,
            fontFamily: cssFamily(cfg.font),
            ...textRevealAnim,
          }}>
            <div style={{ fontSize: 8 * k, letterSpacing: '0.16em', textTransform: 'uppercase', color: cfg.accent, fontWeight: 600, opacity: custom ? 0.65 : 1 }}>
              Now Playing
            </div>
            <div style={{ fontSize: 14 * k, fontWeight: 700, color: cfg.textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {track.track}
            </div>
            <div style={{ fontSize: 11 * k, color: cfg.textColor, opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {track.artist}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
