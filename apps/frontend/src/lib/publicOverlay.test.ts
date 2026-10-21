import { describe, expect, it } from 'vitest';
import { reconcilePublic } from './publicOverlay';
import type { PublicOverlay } from './overlayApi';

const chat: PublicOverlay = { kind: 'chat', config: { fontSize: 22 }, channel: 'streamer', lastfm_username: null };
const nowPlaying: PublicOverlay = { kind: 'nowplaying', config: {}, channel: 'streamer', lastfm_username: 'fm' };

describe('reconcilePublic', () => {
  it('keeps an overlay of the kind the page shows', () => {
    expect(reconcilePublic(chat, 'chat')).toBe(chat);
    expect(reconcilePublic(nowPlaying, 'nowplaying')).toBe(nowPlaying);
  });

  it('treats a missing overlay (rotated, deleted or unknown URL) as gone, so the page can clear itself', () => {
    expect(reconcilePublic(null, 'chat')).toBeNull();
    expect(reconcilePublic(null, 'nowplaying')).toBeNull();
  });

  it('treats a URL that now belongs to the other kind as gone', () => {
    expect(reconcilePublic(nowPlaying, 'chat')).toBeNull();
    expect(reconcilePublic(chat, 'nowplaying')).toBeNull();
  });
});
