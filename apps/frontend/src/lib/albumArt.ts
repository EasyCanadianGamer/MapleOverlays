// Last.fm sends this grey star when it has no cover for a track.
const PLACEHOLDER_ART = '2a96cbd8b46e442fc41c2b86b821562f';

// Last.fm serves the same image from two hostnames.
const LASTFM_IMAGE_HOSTS = ['lastfm.freetls.fastly.net', 'lastfm-img.freetls.fastly.net'];

// The cover to try first, or null when there is nothing worth showing
// (missing, not an http(s) address, or Last.fm's placeholder star).
export function usableArtUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.includes(PLACEHOLDER_ART)) return null;
  return trimmed;
}

// The addresses to try, in order. Last.fm's image server sometimes answers 404
// for a fresh cover on one hostname or edge and works a moment later, so a
// failed load is retried on the other hostname and then with a cache-busting
// query instead of leaving a broken image on screen.
export function artAttempts(url: string): string[] {
  const attempts = [url];
  try {
    const original = new URL(url);
    if (LASTFM_IMAGE_HOSTS.includes(original.hostname)) {
      const other = new URL(url);
      other.hostname = LASTFM_IMAGE_HOSTS.find(h => h !== original.hostname) ?? original.hostname;
      attempts.push(other.toString());
    }
    const busted = new URL(url);
    busted.searchParams.set('r', '1');
    attempts.push(busted.toString());
  } catch {
    // not an address we can rewrite: only the original is tried
  }
  return attempts;
}
