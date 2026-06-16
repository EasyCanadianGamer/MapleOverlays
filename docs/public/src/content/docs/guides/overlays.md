---
title: Overlays
description: Add transparent browser-source overlays to OBS or Streamlabs using MapleOverlays.
---

Overlay pages render as transparent HTML pages designed to be loaded as a **Browser Source** in OBS Studio or Streamlabs. Each overlay URL is unique to your channel and is generated from the **Overlays** section of the dashboard.

## Available Overlays

| Overlay | Description |
|---------|-------------|
| Now Playing | Animated card showing the track currently scrobbling on your Last.fm account |

More overlays are planned. Check the **Overlays** section of the dashboard for the latest list.

## Adding an Overlay in OBS

1. Open OBS Studio and add a new **Browser Source** to your scene.
2. Set the **URL** to the overlay URL shown in the dashboard (click **Copy URL**).
3. Set **Width** and **Height** to match your canvas (usually 1920 × 1080).
4. Check **Shutdown source when not visible** to save resources.
5. Leave the background transparent — do not set a background color in **Custom CSS**.

The overlay page sets a transparent background before the first render, so OBS sees a transparent frame immediately on load with no white flash.

---

## Now Playing Overlay

Displays an animated card with album art, track name, and artist whenever your Last.fm account is scrobbling a track. The card slides in from the edge of the screen, holds for a configurable duration, then slides back out.

### Prerequisites

- A [Last.fm](https://www.last.fm) account
- Scrobbling enabled from your music player (Spotify: connect at last.fm → Settings → Applications)

### Setup

1. Go to **Overlays** in the dashboard and click **Edit** on the Now Playing overlay.
2. Enter your **Last.fm username**.
3. Adjust any style settings you want (see options below).
4. Click **Copy URL** and paste it into OBS as a Browser Source (1920 × 1080).

The dashboard preview polls your Last.fm account live — if you're playing something right now, the card will appear in the preview within the poll interval.

### Triggering from Chat

When a viewer (or you) types `!song` in chat, the overlay card appears immediately in OBS — regardless of the poll interval. This is in addition to the normal bot reply in chat.

See [Commands → `!song`](/reference/commands/) for details.

### Configuration Options

All options are configurable from the dashboard. They map to URL parameters on the overlay URL.

| Option | URL param | Default | Description |
|--------|-----------|---------|-------------|
| Last.fm username | `user` | — | **Required.** The account whose scrobbles are displayed |
| Display duration | `duration` | `10` | Seconds to show the card before it slides out |
| Position | `corner` | `bottom-left` | Where the card appears: `bottom-left`, `bottom-right`, `top-left`, `top-right` |
| Slide direction | `from` | auto | `left` or `right` — defaults to the side matching the corner |
| Accent color | `color` | `#AC0747` | Border, label text, and album art fallback gradient |
| Font | `font` | `Geist` | Font family for track/artist text (Google Fonts supported) |
| Text color | `fcolor` | `#ffffff` | Track name and artist text color |
| Box style | `style` | `glass` | `glass` (frosted outline), `dark` (solid dark), or `stripe` (accent left border) |
| Poll interval | `poll` | `15` | Seconds between Last.fm checks (minimum 10) |

<Aside type="tip">
The **Slide direction** option defaults to `auto`, which automatically chooses left or right based on your corner selection — cards in left-side corners slide in from the left, right-side corners from the right. Set it manually only if you want to override this.
</Aside>

### Animation

**Enter (1.1 s):** The card slides in from the configured edge with a subtle bounce. Album art pops in with a spring effect simultaneously. Track name and artist fade in with a short delay after the card settles.

**Exit (0.85 s):** The card nudges slightly toward the exit edge, then slides fully off screen with a quick ease-in.

### Album Art

When Last.fm provides album art for the current track, it is displayed in the card. If no art is available, a gradient placeholder using your accent color is shown instead.
