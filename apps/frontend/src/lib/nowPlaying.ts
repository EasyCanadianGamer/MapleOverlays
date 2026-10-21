import { legacyFontRef } from './fontRef';

export type Corner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
export type NpSize = 'sm' | 'md' | 'lg';
// glass, dark and stripe are the original MapleOverlays card looks, kept for
// old links. 'custom' is the look built from the settings panel.
export type NpStyle = 'glass' | 'dark' | 'stripe' | 'custom';

export interface NpConfig {
  user: string;
  channel: string;
  popupSeconds: number;
  poll: number;
  corner: Corner;
  from: 'left' | 'right';
  font: string;
  textColor: string;
  accent: string;
  style: NpStyle;
  bgColor: string;
  size: NpSize;
  transparentBackground: boolean;
  shadowOpacity: number;
  cornerRounding: number;
  stayOpen: boolean;
  onlyOnCommand: boolean;
}

const CORNERS: Corner[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
const DEFAULTS = { popupSeconds: 10, poll: 15, accent: '#AC0747', bgColor: '#0c0806', textColor: '#ffffff', shadowOpacity: 40, cornerRounding: 15 };

// The original URL-parameter configuration. Old OBS sources keep working unchanged.
export function parseLegacyConfig(sp: URLSearchParams): NpConfig {
  const cornerParam = sp.get('corner');
  const corner: Corner = CORNERS.includes(cornerParam as Corner) ? (cornerParam as Corner) : 'bottom-left';
  const fromParam = sp.get('from');
  const from: 'left' | 'right' =
    fromParam === 'left' || fromParam === 'right' ? fromParam : corner.includes('right') ? 'right' : 'left';
  const styleParam = sp.get('style');
  const style: NpStyle = styleParam === 'dark' || styleParam === 'stripe' ? styleParam : 'glass';

  const duration = Number(sp.get('duration') ?? DEFAULTS.popupSeconds);
  const poll = Number(sp.get('poll') ?? DEFAULTS.poll);

  return {
    user: sp.get('user') ?? '',
    channel: sp.get('channel') ?? '',
    popupSeconds: Number.isFinite(duration) && duration > 0 ? duration : DEFAULTS.popupSeconds,
    poll: Number.isFinite(poll) ? Math.max(10, poll) : DEFAULTS.poll,
    corner,
    from,
    font: legacyFontRef(sp.get('font') ?? 'Geist'),
    textColor: sp.get('fcolor') ?? DEFAULTS.textColor,
    accent: sp.get('color') ?? DEFAULTS.accent,
    style,
    bgColor: DEFAULTS.bgColor,
    size: 'md',
    transparentBackground: false,
    shadowOpacity: DEFAULTS.shadowOpacity,
    cornerRounding: DEFAULTS.cornerRounding,
    stayOpen: false,
    onlyOnCommand: false,
  };
}

// A stored (token) config. The API always sends every key; the fallbacks only
// guard against a malformed response.
export function configFromToken(config: Record<string, unknown>, channel: string, user: string): NpConfig {
  const str = (key: string, fallback: string) => (typeof config[key] === 'string' ? (config[key] as string) : fallback);
  const num = (key: string, fallback: number) =>
    (typeof config[key] === 'number' && Number.isFinite(config[key]) ? (config[key] as number) : fallback);
  const bool = (key: string, fallback: boolean) => (typeof config[key] === 'boolean' ? (config[key] as boolean) : fallback);

  const size: NpSize = config.size === 'sm' || config.size === 'lg' ? config.size : 'md';
  const textColor = str('textColor', DEFAULTS.textColor);

  return {
    user,
    channel,
    popupSeconds: num('popupSeconds', DEFAULTS.popupSeconds),
    poll: DEFAULTS.poll,
    corner: 'bottom-left',
    from: 'left',
    font: str('font', 'builtin:Geist'),
    textColor,
    accent: textColor,
    style: 'custom',
    bgColor: str('bgColor', DEFAULTS.bgColor),
    size,
    transparentBackground: bool('transparentBackground', false),
    shadowOpacity: num('shadowOpacity', DEFAULTS.shadowOpacity),
    cornerRounding: num('cornerRounding', DEFAULTS.cornerRounding),
    stayOpen: bool('stayOpen', false),
    onlyOnCommand: bool('onlyOnCommand', false),
  };
}

// 'reset' forgets the track without animating anything: the card was already gone.
export type PollDecision = 'show' | 'hide' | 'reset' | 'none';

// What to do after a Last.fm poll or a !song trigger.
//   lastKey is the key of the track already on screen ('' when nothing is).
//   force is true when the poll was caused by the trigger command.
//   visible is true while the card is on screen or sliding in.
export function decidePoll(args: {
  isPlaying: boolean;
  key: string;
  lastKey: string;
  force: boolean;
  visible: boolean;
  cfg: Pick<NpConfig, 'stayOpen' | 'onlyOnCommand'>;
}): PollDecision {
  const { isPlaying, key, lastKey, force, visible, cfg } = args;
  if (!isPlaying) {
    if (!lastKey) return 'none';
    return visible ? 'hide' : 'reset';
  }
  // Stay-open keeps the card up for as long as a track plays. If it is missing (stay-open was
  // just switched on after a popup had already gone), bring it back even though the track is the same.
  if (cfg.stayOpen) return key !== lastKey || !visible ? 'show' : 'none';
  if (cfg.onlyOnCommand) return force ? 'show' : 'none';
  return force || key !== lastKey ? 'show' : 'none';
}

// Stay-open means no pop-in or pop-out: while the card is already up, a new track only swaps the
// text and cover in place. The entrance plays only when the card has to come onto the screen.
export function shouldAnimateIn(stayOpen: boolean, anim: string): boolean {
  return !(stayOpen && anim === 'visible');
}
