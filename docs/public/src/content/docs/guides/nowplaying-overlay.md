---
title: Now Playing
description: Show the track playing on your Last.fm account as an animated card in OBS.
---

The Now Playing overlay shows an animated card with album art, the track name and the artist whenever your Last.fm account is scrobbling. The card slides in, holds for a few seconds, then slides back out. On the **Overlays** page click **Add overlay** and choose **Now Playing overlay**, adjust the look in the editor, and watch the preview. You can make as many Now Playing overlays as you like, each with its own name and look. See [Managing Overlays](/guides/managing-overlays/).

## What you need

- A [Last.fm](https://www.last.fm) account with scrobbling turned on in your music app (Spotify: last.fm → Settings → Applications).
- Your Last.fm username, entered in the **Account** card at the bottom of any Now Playing editor. It is one value for your whole channel, shared by all your Now Playing overlays and by the **Settings** page.
- The bot invited to your channel once (**Bot → Settings**), so the dashboard knows your channel.

## Add it to OBS

1. In the editor, click **Copy URL** under **OBS browser source**.
2. Add a **Browser Source** in OBS, paste the URL, and set it to your canvas size (usually 1920 × 1080).
3. Leave the background alone: the page is transparent.

The card sits in the bottom left. Settings you save reach OBS within about 15 seconds, with no refresh.

## Settings

### Info

The overlay's name and description, in the **Info** card at the top of the editor. They label the overlay on the Overlays page and do not appear on the card.

### Style

| Setting | Default | Notes |
|---------|---------|-------|
| Background color | `#0c0806` | |
| Text color | `#ffffff` | |
| Size | Medium | Large, Medium or Small. |
| Transparent background | Off | Removes the card background. |
| Shadow opacity (%) | 40 | 0 to 100. |
| Corner rounding (px) | 15 | 0 to 50. |
| Font face | Built-in Geist | Built-in, Google Fonts, or your own upload (`.woff2`, `.woff`, `.ttf`, `.otf`, up to 2 MB). |

### Other

| Setting | Default | Notes |
|---------|---------|-------|
| Stay open all the time | Off | The card stays on screen while a track is playing and hides when playback stops. |
| Only trigger on command, not on song change | Off | The card appears only when someone uses `!song`. |

If both are on, **stay open** wins.

The command that triggers the card is `!song`. You enable it, disable it, change its reply or restrict who can use it on the **Bot → Commands** page. Disabling `!song` there also stops it triggering the card. `!song` triggers all of your Now Playing overlays at once, and each one then follows its own settings.

### Customize

| Setting | Default | Notes |
|---------|---------|-------|
| Length of popup (seconds) | 10 | 2 to 100. Ignored when the card stays open. |

### Account

Your Last.fm username. It is the same value as on the **Settings** page and in every other Now Playing overlay, so changing it in any of those places changes all of them.

## When the card appears

By default the card pops up in two situations: when the track changes, and when `!song` is used in chat. Either way it stays for the popup length, then slides out. The bot still replies in chat when `!song` is used.

The overlay checks Last.fm every 15 seconds.

## Older links with URL parameters

If you already have a Now Playing source that uses the old URL parameters, it keeps working exactly as before. The old link format is `/overlays/nowplaying?user=...` and it ignores the dashboard settings above.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `user` | none | **Required.** The Last.fm username. |
| `channel` | none | Your Twitch login, so `!song` can trigger the card. |
| `duration` | `10` | Seconds the card stays. |
| `corner` | `bottom-left` | `bottom-left`, `bottom-right`, `top-left` or `top-right`. |
| `from` | automatic | `left` or `right`: the side the card slides in from. |
| `color` | `#AC0747` | Accent color. |
| `font` | `Geist` | A built-in or Google Fonts family. |
| `fcolor` | `#ffffff` | Text color. |
| `style` | `glass` | `glass`, `dark` or `stripe`. |
| `poll` | `15` | Seconds between Last.fm checks, 10 at the lowest. |

New overlays should use the dashboard URL instead: it has more options and no username in the link.

## Troubleshooting

- **Nothing appears.** Check the username, that your music app is scrobbling (your Last.fm profile should show "Scrobbling now"), and that **Only trigger on command** is off if you expect it to appear by itself.
- **`!song` does nothing.** The command may be disabled or limited to a role on **Bot → Commands**, or the bot may not be in your channel.
- **No album art.** Last.fm does not have art for every track. A plain card with an icon is shown instead.
- **A URL stopped working.** You may have clicked **New URL** or deleted that overlay. Copy the current URL from the Overlays page.
