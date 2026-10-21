import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import NowPlayingCard, { ENTER_MS, EXIT_MS, type AnimState, type TrackData } from '../components/overlay/NowPlayingCard';
import { configFromToken, decidePoll, parseLegacyConfig, shouldAnimateIn, type NpConfig } from '../lib/nowPlaying';
import { apiUrl, getPublicOverlay } from '../lib/overlayApi';
import { reconcilePublic } from '../lib/publicOverlay';
import { useOverlayFont } from '../lib/useOverlayFont';

const CONFIG_POLL_MS = 15_000;
const TRIGGER_POLL_MS = 5_000;

const MOCK_TRACK: TrackData = { isPlaying: true, track: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', albumArt: '' };

function NowPlayingRunner({ config, autoplay }: { config: NpConfig; autoplay: boolean }) {
  const [animState, setAnimStateRaw] = useState<AnimState>('hidden');
  // Mirrors animState so the poll can ask "is the card on screen?" without a stale closure.
  const animRef = useRef<AnimState>('hidden');
  const setAnimState = useCallback((next: AnimState) => { animRef.current = next; setAnimStateRaw(next); }, []);
  const [track, setTrack] = useState<TrackData | null>(null);
  const lastKeyRef = useRef('');
  const trackRef = useRef<TrackData | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useOverlayFont(config.font);

  const clearTimers = useCallback(() => {
    for (const ref of [dismissTimer, enterTimer, exitTimer]) {
      if (ref.current) clearTimeout(ref.current);
      ref.current = null;
    }
  }, []);

  const show = useCallback((data: TrackData) => {
    trackRef.current = data;
    setTrack(data);
    // Stay-open with the card already up: swap the track in place, no exit and re-entrance.
    if (!shouldAnimateIn(config.stayOpen, animRef.current)) return;
    clearTimers();
    setAnimState('entering');
    enterTimer.current = setTimeout(() => setAnimState('visible'), ENTER_MS + 50);
    if (!config.stayOpen) {
      dismissTimer.current = setTimeout(() => {
        if (enterTimer.current) clearTimeout(enterTimer.current);
        setAnimState('exiting');
        exitTimer.current = setTimeout(() => setAnimState('hidden'), EXIT_MS + 50);
      }, ENTER_MS + 50 + config.popupSeconds * 1000);
    }
  }, [config.popupSeconds, config.stayOpen, clearTimers, setAnimState]);

  const hide = useCallback(() => {
    clearTimers();
    setAnimState('exiting');
    exitTimer.current = setTimeout(() => setAnimState('hidden'), EXIT_MS + 50);
  }, [clearTimers, setAnimState]);

  // Switching "stay open" live: turning it on cancels the pending dismissal;
  // turning it off while a card is up restarts a normal popup so it cannot stay stuck.
  useEffect(() => {
    if (config.stayOpen) {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
      return;
    }
    if (lastKeyRef.current && trackRef.current) show(trackRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.stayOpen]);

  // One Last.fm check. Also used when the trigger command fires (force = true).
  const pollLastFm = useCallback(async (force = false) => {
    if (!config.user) return;
    try {
      const res = await fetch(`${apiUrl}/nowplaying/json?user=${encodeURIComponent(config.user)}`);
      if (!res.ok) return;
      const data = await res.json() as TrackData;
      const key = data.isPlaying ? `${data.track ?? ''}||${data.artist ?? ''}` : '';
      const visible = animRef.current === 'entering' || animRef.current === 'visible';
      const decision = decidePoll({ isPlaying: data.isPlaying, key, lastKey: lastKeyRef.current, force, visible, cfg: config });
      if (decision === 'show') {
        lastKeyRef.current = key;
        show(data);
      } else if (decision === 'hide') {
        lastKeyRef.current = '';
        hide();
      } else if (decision === 'reset') {
        lastKeyRef.current = '';
      }
    } catch { /* silent: the next poll will try again */ }
  }, [config, show, hide]);

  useEffect(() => {
    if (!config.user) return;
    void pollLastFm();
    const interval = setInterval(() => void pollLastFm(), config.poll * 1000);
    return () => clearInterval(interval);
  }, [config.user, config.poll, pollLastFm]);

  // The bot writes a timestamp when !song is used. The first answer only records it,
  // so an old trigger does not pop the card up every time OBS loads the page.
  useEffect(() => {
    if (!config.channel) return;
    let lastSeen: string | null = null;
    let primed = false;
    const check = async () => {
      try {
        const res = await fetch(`${apiUrl}/nowplaying/triggered?channel=${encodeURIComponent(config.channel)}`);
        if (!res.ok) return;
        const { triggered_at } = await res.json() as { triggered_at: string | null };
        if (primed && triggered_at && triggered_at !== lastSeen) void pollLastFm(true);
        lastSeen = triggered_at;
        primed = true;
      } catch { /* silent */ }
    };
    void check();
    const interval = setInterval(() => void check(), TRIGGER_POLL_MS);
    return () => clearInterval(interval);
  }, [config.channel, pollLastFm]);

  // ?autoplay=1 shows a sample track shortly after load, for previews.
  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => show(MOCK_TRACK), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  if (animState === 'hidden' || !track) return null;
  return <NowPlayingCard cfg={config} track={track} animState={animState} />;
}

export default function NowPlayingOverlay() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const legacy = useMemo(() => parseLegacyConfig(searchParams), [searchParams]);
  const [stored, setStored] = useState<NpConfig | null>(null);
  const lastSeen = useRef('');

  // Token mode: re-read the stored config every 15 s so dashboard changes reach OBS.
  // A failed or 404 poll keeps what is on screen; the page never errors or loops.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = reconcilePublic(await getPublicOverlay(token), 'nowplaying');
        if (cancelled) return;
        if (!data) {
          // The URL was rotated or deleted: stop showing the overlay.
          lastSeen.current = '';
          setStored(null);
          return;
        }
        const signature = JSON.stringify([data.config, data.channel, data.lastfm_username]);
        if (signature === lastSeen.current) return;
        lastSeen.current = signature;
        setStored(configFromToken(data.config, data.channel, data.lastfm_username ?? ''));
      } catch { /* keep the last good config */ }
    };
    void load();
    const timer = setInterval(() => void load(), CONFIG_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [token]);

  const config = token ? stored : legacy;
  if (!config) return null;
  return <NowPlayingRunner config={config} autoplay={!token && searchParams.get('autoplay') === '1'} />;
}
