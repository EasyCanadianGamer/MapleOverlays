/**
 * Default overlay sounds synthesised via Web Audio API.
 * No files needed. When custom sounds are added later, replace the
 * play* functions with `new Audio('/sounds/follow.ogg').play()` etc.
 *
 * AudioContext must be created (or resumed) from a user gesture — the
 * exported `playOverlaySound` handles that automatically.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // Browsers suspend the context until a user gesture — resume if needed.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Schedule a single synthesised tone. */
function tone(
  ac: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume = 0.28,
  type: OscillatorType = 'sine',
): void {
  const osc  = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  // Quick attack, exponential decay
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// ── Per-overlay sounds ────────────────────────────────────────────────────────

function playFollow(): void {
  const ac  = getCtx();
  const now = ac.currentTime;
  // Two rising notes — light and friendly
  tone(ac, 440, now,        0.18);
  tone(ac, 660, now + 0.14, 0.28);
}

function playSub(): void {
  const ac  = getCtx();
  const now = ac.currentTime;
  // Ascending C-E-G-C arpeggio — celebratory
  [261, 329, 392, 523].forEach((freq, i) => {
    tone(ac, freq, now + i * 0.11, 0.22, 0.26);
  });
}

function playBits(): void {
  const ac  = getCtx();
  const now = ac.currentTime;
  // Quick coin-like chime
  tone(ac, 1200, now,        0.07, 0.30, 'triangle');
  tone(ac, 900,  now + 0.06, 0.12, 0.20, 'triangle');
}

function playRaid(): void {
  const ac  = getCtx();
  const now = ac.currentTime;
  // Rising fanfare — punchy and dramatic
  tone(ac, 220, now,        0.14, 0.18, 'sawtooth');
  tone(ac, 330, now + 0.11, 0.14, 0.18, 'sawtooth');
  tone(ac, 440, now + 0.22, 0.14, 0.18, 'sawtooth');
  tone(ac, 660, now + 0.33, 0.32, 0.22, 'sawtooth');
}

// ── Public API ────────────────────────────────────────────────────────────────

const SOUND_MAP: Record<string, () => void> = {
  follow: playFollow,
  sub:    playSub,
  bits:   playBits,
  raid:   playRaid,
};

/**
 * Play the default sound for a given overlay ID.
 * Silent for overlays with no defined sound (chat, brb).
 */
export function playOverlaySound(overlayId: string): void {
  SOUND_MAP[overlayId]?.();
}
