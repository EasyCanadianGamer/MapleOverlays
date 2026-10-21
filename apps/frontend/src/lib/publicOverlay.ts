import type { OverlayKind, PublicOverlay } from './overlayApi';

// What an OBS page should show after asking the server for its overlay by token.
// Returns null when the overlay no longer exists for this page: the URL was
// rotated or deleted, never existed, or now belongs to the other kind. The page
// must then clear what it shows (and stop reading chat), because an OBS browser
// source stays open for hours and a revoked URL has to stop working there too.
// A network error or a 5xx is different: it throws before reaching this, and
// the page keeps its last good settings.
export function reconcilePublic(data: PublicOverlay | null, kind: OverlayKind): PublicOverlay | null {
  return data !== null && data.kind === kind ? data : null;
}
