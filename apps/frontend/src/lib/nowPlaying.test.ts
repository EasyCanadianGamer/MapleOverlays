import { describe, expect, it } from 'vitest';
import { configFromToken, decidePoll, parseLegacyConfig, shouldAnimateIn } from './nowPlaying';

const sp = (query: string) => new URLSearchParams(query);

describe('parseLegacyConfig', () => {
  it('keeps the original defaults', () => {
    expect(parseLegacyConfig(sp(''))).toMatchObject({
      user: '', channel: '', popupSeconds: 10, poll: 15, corner: 'bottom-left', from: 'left',
      font: 'builtin:Geist', textColor: '#ffffff', accent: '#AC0747', style: 'glass',
      stayOpen: false, onlyOnCommand: false,
    });
  });

  it('reads every legacy parameter', () => {
    const cfg = parseLegacyConfig(sp(
      'user=me&channel=chan&duration=20&corner=top-right&from=left&color=%2300ff00&font=Poppins&fcolor=%23111111&style=stripe&poll=30',
    ));
    expect(cfg).toMatchObject({
      user: 'me', channel: 'chan', popupSeconds: 20, corner: 'top-right', from: 'left', accent: '#00ff00',
      font: 'google:Poppins', textColor: '#111111', style: 'stripe', poll: 30,
    });
  });

  it('chooses the slide side from the corner unless told otherwise', () => {
    expect(parseLegacyConfig(sp('corner=bottom-right')).from).toBe('right');
    expect(parseLegacyConfig(sp('corner=top-left')).from).toBe('left');
    expect(parseLegacyConfig(sp('corner=top-left&from=right')).from).toBe('right');
    expect(parseLegacyConfig(sp('from=sideways')).from).toBe('left');
  });

  it('falls back to defaults on garbage instead of breaking', () => {
    const cfg = parseLegacyConfig(sp('corner=middle&style=neon&duration=abc&poll=abc&font=a%22b'));
    expect(cfg).toMatchObject({ corner: 'bottom-left', style: 'glass', popupSeconds: 10, poll: 15, font: 'builtin:Geist' });
  });

  it('never polls more often than every 10 seconds, and survives a NaN poll', () => {
    expect(parseLegacyConfig(sp('poll=1')).poll).toBe(10);
    expect(parseLegacyConfig(sp('poll=0')).poll).toBe(10);
    expect(parseLegacyConfig(sp('poll=-5')).poll).toBe(10);
    expect(Number.isFinite(parseLegacyConfig(sp('poll=nope')).poll)).toBe(true);
  });

  it('ignores zero or negative durations', () => {
    expect(parseLegacyConfig(sp('duration=0')).popupSeconds).toBe(10);
    expect(parseLegacyConfig(sp('duration=-3')).popupSeconds).toBe(10);
  });
});

describe('configFromToken', () => {
  it('maps a stored config onto the runtime config', () => {
    const cfg = configFromToken({
      bgColor: '#112233', textColor: '#ddeeff', size: 'lg', transparentBackground: true,
      shadowOpacity: 10, cornerRounding: 4, font: 'google:Poppins', stayOpen: true, onlyOnCommand: true, popupSeconds: 33,
    }, 'mychannel', 'mylastfm');
    expect(cfg).toMatchObject({
      user: 'mylastfm', channel: 'mychannel', style: 'custom', bgColor: '#112233', textColor: '#ddeeff', accent: '#ddeeff',
      size: 'lg', transparentBackground: true, shadowOpacity: 10, cornerRounding: 4, font: 'google:Poppins',
      stayOpen: true, onlyOnCommand: true, popupSeconds: 33, poll: 15, corner: 'bottom-left', from: 'left',
    });
  });

  it('uses defaults for missing keys and ignores wrong types', () => {
    const cfg = configFromToken({ size: 'huge', popupSeconds: '12', stayOpen: 'yes', bgColor: 5 }, '', '');
    expect(cfg).toMatchObject({
      size: 'md', popupSeconds: 10, stayOpen: false, bgColor: '#0c0806', textColor: '#ffffff',
      shadowOpacity: 40, cornerRounding: 15, font: 'builtin:Geist', transparentBackground: false, onlyOnCommand: false,
    });
  });
});

describe('decidePoll', () => {
  const normal = { stayOpen: false, onlyOnCommand: false };
  const base = { isPlaying: true, key: 'song||artist', lastKey: '', force: false, visible: true, cfg: normal };

  it('default mode shows a new track, shows on command, and hides when playback stops', () => {
    expect(decidePoll(base)).toBe('show');
    expect(decidePoll({ ...base, lastKey: 'other||x' })).toBe('show');
    expect(decidePoll({ ...base, lastKey: 'song||artist' })).toBe('none');
    expect(decidePoll({ ...base, lastKey: 'song||artist', force: true })).toBe('show');
    expect(decidePoll({ ...base, isPlaying: false, key: '', lastKey: 'song||artist' })).toBe('hide');
    expect(decidePoll({ ...base, isPlaying: false, key: '', lastKey: '' })).toBe('none');
  });

  it('only-on-command ignores track changes and responds to the command', () => {
    const cfg = { stayOpen: false, onlyOnCommand: true };
    expect(decidePoll({ ...base, cfg })).toBe('none');
    expect(decidePoll({ ...base, cfg, lastKey: 'other||x' })).toBe('none');
    expect(decidePoll({ ...base, cfg, force: true })).toBe('show');
    expect(decidePoll({ ...base, cfg, isPlaying: false, key: '', lastKey: 'song||artist' })).toBe('hide');
    expect(decidePoll({ ...base, cfg, isPlaying: false, key: '', force: true })).toBe('none');
  });

  it('stay-open shows each new track once, ignores the command, and hides when playback stops', () => {
    const cfg = { stayOpen: true, onlyOnCommand: false };
    expect(decidePoll({ ...base, cfg })).toBe('show');
    expect(decidePoll({ ...base, cfg, lastKey: 'other||x' })).toBe('show');
    expect(decidePoll({ ...base, cfg, lastKey: 'song||artist' })).toBe('none');
    expect(decidePoll({ ...base, cfg, lastKey: 'song||artist', force: true })).toBe('none');
    expect(decidePoll({ ...base, cfg, isPlaying: false, key: '', lastKey: 'song||artist' })).toBe('hide');
  });

  it('does not animate a hide for a card that is already gone, but still forgets the track', () => {
    const stopped = { ...base, isPlaying: false, key: '', lastKey: 'song||artist', visible: false };
    for (const cfg of [normal, { stayOpen: false, onlyOnCommand: true }, { stayOpen: true, onlyOnCommand: false }]) {
      expect(decidePoll({ ...stopped, cfg })).toBe('reset');
    }
    expect(decidePoll({ ...stopped, lastKey: '' })).toBe('none');
    expect(decidePoll({ ...stopped, visible: true })).toBe('hide');
  });

  it('stay-open wins when both switches are on', () => {
    const cfg = { stayOpen: true, onlyOnCommand: true };
    expect(decidePoll({ ...base, cfg })).toBe('show');
    expect(decidePoll({ ...base, cfg, lastKey: 'song||artist', force: true })).toBe('none');
  });
});

describe('stay-open edge cases', () => {
  const cfg = { stayOpen: true, onlyOnCommand: false };
  const playing = { isPlaying: true, key: 'song||artist', lastKey: 'song||artist', force: false, cfg };

  it('brings the card back when stay-open is switched on while the same track is playing but the card is hidden', () => {
    expect(decidePoll({ ...playing, visible: false })).toBe('show');
  });

  it('leaves a card that is already on screen alone', () => {
    expect(decidePoll({ ...playing, visible: true })).toBe('none');
  });

  it('only plays the entrance animation when the card is not already up in stay-open mode', () => {
    expect(shouldAnimateIn(true, 'visible')).toBe(false);
    expect(shouldAnimateIn(true, 'hidden')).toBe(true);
    expect(shouldAnimateIn(true, 'exiting')).toBe(true);
    expect(shouldAnimateIn(true, 'entering')).toBe(true);
    expect(shouldAnimateIn(false, 'visible')).toBe(true);
  });
});
