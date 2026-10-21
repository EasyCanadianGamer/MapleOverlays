import { useMemo } from 'react';
import NowPlayingCard, { type TrackData } from './NowPlayingCard';
import { configFromToken } from '../../lib/nowPlaying';
import type { OverlayConfig } from '../../lib/overlayApi';
import { useOverlayFont } from '../../lib/useOverlayFont';

const MOCK_TRACK: TrackData = { isPlaying: true, track: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', albumArt: '' };

export default function NowPlayingPreview({ config }: { config: OverlayConfig }) {
  const cfg = useMemo(() => configFromToken(config, '', ''), [config]);
  useOverlayFont(cfg.font);
  return <NowPlayingCard cfg={cfg} track={MOCK_TRACK} animState="visible" />;
}
