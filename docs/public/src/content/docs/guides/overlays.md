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

---

## Custom Overlays

Beyond the built-in overlays above, the **Overlays** section of the dashboard also has a drag-and-drop canvas editor for building your own overlay layout from a palette of widgets. Each custom overlay gets its own OBS Browser Source URL (`/overlays/custom/<id>`), independent of the built-in overlay URLs.

### Widget Types

| Widget | Description |
|--------|-------------|
| Text | Static or templated text with font, size, colour, and alignment controls |
| Image | A single image from a URL, with `contain`/`cover` fit |
| Custom Code | Your own HTML, CSS, and JavaScript, edited in-browser and rendered live |
| Now Playing | The same Now Playing card described above, sized and positioned independently |
| Shoutout | The same Shoutout card triggered by `!so`, sized and positioned independently |
| Live Chat | A scrolling feed of recent chat messages from a Twitch channel |

Every widget is positioned and resized by dragging it directly on the canvas; geometry is stored as a percentage of the canvas so the layout looks the same at any OBS source resolution.

### Custom Code Widget

The Custom Code widget gives you three editable panes — HTML, CSS, and JavaScript — and renders the result live in the canvas as you type.

<Aside type="caution">
Custom code runs in a sandboxed frame with no access to your dashboard, your Twitch login, or any other widget on the canvas — it cannot read cookies, local storage, or the rest of the page. It can still make its own network requests (e.g. to a public API), and it is visible to anyone who has the overlay's OBS URL, so avoid putting anything sensitive in it.
</Aside>

#### Configurable Fields

A fourth pane, **Fields**, lets you define your own configurable values as JSON instead of hardcoding them into your JavaScript:

```json
{
  "greeting": { "type": "text", "label": "Greeting", "value": "Hello, overlay!" }
}
```

The resolved values are delivered to your JavaScript once the widget loads:

```js
window.addEventListener('onWidgetLoad', (obj) => {
  const fields = obj.detail.fieldData;
  document.body.textContent = fields.greeting;
});
```

#### Chat Commands (Porting a StreamElements Widget)

Fill in a **Twitch channel** above the code panes to connect the widget to that channel's live chat. Messages are delivered to your JavaScript the same way StreamElements delivers them, so most StreamElements chat-command widgets can be pasted in with little to no changes:

```js
window.addEventListener('onEventReceived', (obj) => {
  if (obj.detail.listener !== 'message') return;
  const data = obj.detail.event.data;
  console.log(data.text, data.displayName, data.username, data.tags.mod, data.tags.badges);
});
```

Leave the channel field blank to keep the widget chat-free.

### Now Playing / Shoutout Widgets

These reuse the exact same Now Playing and Shoutout behavior described earlier in this guide (same triggers, same live polling) but as an independently sized and positioned widget on your custom canvas, so you can combine them with other widgets in one layout instead of using a separate OBS Browser Source for each.

### Live Chat Widget

Shows recent messages from a Twitch channel's chat, styled with your choice of font, size, and colours. Connects anonymously and read-only — no login is required for the widget to work.
