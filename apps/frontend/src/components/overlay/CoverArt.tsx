import { useEffect, useMemo, useRef, useState } from 'react';
import { artAttempts, usableArtUrl } from '../../lib/albumArt';

// Wait before moving on to attempt 1 (the other hostname) and attempt 2 (cache-busted).
const RETRY_DELAYS_MS = [0, 3000];

// The album cover inside the Now Playing card. It never shows a broken image:
// the music-note placeholder is drawn until the cover has actually loaded, a
// failed load is retried (see artAttempts), and if every attempt fails the
// placeholder simply stays.
export default function CoverArt({ url, emojiSize }: { url?: string; emojiSize: number }) {
  const usable = usableArtUrl(url);
  const attempts = useMemo(() => (usable ? artAttempts(usable) : []), [usable]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new track starts from scratch.
  useEffect(() => {
    setIndex(0);
    setLoaded(false);
    setFailed(false);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [usable]);

  const onError = () => {
    if (index >= attempts.length - 1) {
      setFailed(true);
      return;
    }
    timer.current = setTimeout(() => setIndex(i => i + 1), RETRY_DELAYS_MS[index] ?? 3000);
  };

  const src = attempts[index];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {(!src || failed || !loaded) && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: emojiSize }}>🎵</div>
      )}
      {src && !failed && (
        <img
          key={src}
          src={src}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={onError}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: loaded ? 1 : 0 }}
        />
      )}
    </div>
  );
}
