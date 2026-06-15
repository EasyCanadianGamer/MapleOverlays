---
title: Overlays
description: Add transparent browser-source overlays to OBS or Streamlabs using MapleOverlays.
---

Overlay pages render as transparent HTML pages designed to be loaded as a **Browser Source** in OBS Studio or Streamlabs. Each overlay URL is unique to your channel.

## Available Overlays

| Overlay | URL path | Description |
|---------|---------|-------------|
| Now Playing | `/overlays/nowplaying` | Displays the track currently scrobbling on your Last.fm account |

More overlays are planned. Check the **Overlays** section of the dashboard for the latest list.

## Adding an Overlay in OBS

1. Open OBS Studio and add a new **Browser Source** to your scene.
2. Set the **URL** to your overlay URL (shown in the dashboard under Overlays).
3. Set **Width** and **Height** to match your canvas (usually 1920 × 1080).
4. Check **Shutdown source when not visible** to save resources.
5. Leave the background transparent — do not check **Custom CSS** with a background color.

The overlay page injects a transparent background style before the first render, so OBS will see a transparent frame immediately on load.

## Now Playing Overlay

Requires a Last.fm account with scrobbling enabled. Set your Last.fm username in **Settings** on the dashboard. The overlay polls the API every few seconds and updates the displayed track automatically.

If you're not scrobbling anything, the overlay displays a default "nothing playing" message rather than going blank.
