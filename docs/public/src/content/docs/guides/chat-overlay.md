---
title: Chat Overlay
description: Style your Twitch chat for OBS with a live preview, custom fonts, emotes and optional CSS.
---

The chat overlay shows your Twitch chat as a transparent page for OBS. It starts completely plain, with no preset themes, so it ends up looking like yours. On the **Overlays** page click **Add overlay** and choose **Chat overlay**, then change anything in the editor and the preview updates as you go. You can make as many chat overlays as you like and give each its own name. See [Managing Overlays](/guides/managing-overlays/).

:::note
You need to invite the bot to your channel once (**Bot → Settings**) before the dashboard can save overlays. See [Bot Setup](/guides/bot-setup/).
:::

## Add it to OBS

1. In the editor, click **Copy URL** under **OBS browser source**.
2. In OBS, add a **Browser Source** and paste the URL.
3. Set **Width** and **Height** to your canvas (usually 1920 × 1080).
4. Leave the background alone. The page is transparent from the first frame.

Changes you save in the dashboard reach OBS within about 15 seconds, with no refresh. Chat is read directly from Twitch in the browser, with no login needed.

:::caution
Anyone with the URL can see your overlay. If it leaks, click **New URL**: the old URL stops working immediately and you paste the new one into OBS.
:::

## Settings

### Info

The overlay's name and description, in the **Info** card at the top of the editor. They label the overlay on the Overlays page and do not appear in chat.

### Layout

| Setting | Default | Notes |
|---------|---------|-------|
| Direction | Newest at the bottom | Or newest at the top. |
| Max messages on screen | 12 | 1 to 50. |
| Message lifetime (seconds) | 0 | 0 to 600. 0 keeps messages until newer ones push them out. |
| Fade-out time (seconds) | 1 | 0 to 10. Used when a lifetime is set. |
| Spacing between messages (px) | 6 | 0 to 40. |

### Typography

| Setting | Default | Notes |
|---------|---------|-------|
| Font | Built-in Geist | Built-in, Google Fonts, or your own upload. See [Fonts](#fonts). |
| Size (px) | 22 | 10 to 96. |
| Weight | Medium | Regular to Extra bold. |
| Text color | `#ffffff` | |
| Text shadow | On | A soft dark shadow so text stays readable over video. |

### Username

| Setting | Default | Notes |
|---------|---------|-------|
| Use each viewer's Twitch color | On | Turn off to use the custom color below for everyone. |
| Custom username color | `#ffffff` | Also used for viewers who have not picked a Twitch color. |
| Bold usernames | On | |
| Show badges | On | Subscriber, moderator, VIP and other badges, including your channel's custom ones. |

### Message box

| Setting | Default | Notes |
|---------|---------|-------|
| Background color | `#000000` | |
| Background opacity (%) | 0 | 0 is fully transparent. |
| Border width (px) / color | 0 / `#ffffff` | 0 means no border. |
| Corner rounding (px) | 8 | 0 to 40. |
| Padding (px) | 6 | 0 to 40. |
| Separate box for each message | Off | Off draws one box around the whole chat. |

### Animation

| Setting | Default | Notes |
|---------|---------|-------|
| Entrance | Slide | None, Fade, Slide or Pop. |
| Entrance speed (ms) | 300 | 0 to 2000. |

### Filters

| Setting | Default | Notes |
|---------|---------|-------|
| Hide commands | On | Hides messages that start with `!`. |
| Hide these users | empty | Comma-separated usernames, for example your other bots. Not case sensitive. |
| Hide messages containing | empty | Comma-separated words or phrases. Matches anywhere in a message, not case sensitive. |

Deleted messages and banned or timed-out users disappear from the overlay automatically.

### Emotes

| Setting | Default | Notes |
|---------|---------|-------|
| Emote size (%) | 100 | 50 to 300. |
| Twitch emotes | On | |
| 7TV, BetterTTV, FrankerFaceZ emotes | On | Your channel's emotes and the global ones. A viewer's message shows the emote when a whole word matches an emote name exactly, including capitals. |

Emote and badge lists are cached for ten minutes. If one of those services is down, chat still shows normally: the missing emotes just appear as text until it recovers.

## Fonts

The font picker has three tabs:

- **Built-in:** Geist, Geist Mono and Bricolage Grotesque.
- **Google Fonts:** type any family name, for example `Poppins`.
- **Upload:** upload your own `.woff2`, `.woff`, `.ttf` or `.otf` file, up to 2 MB each, 10 fonts per channel. The file is checked by its contents, so a renamed file is rejected. The font is stored with the rest of your settings and loaded by the overlay itself, so nothing needs installing on the streaming PC.

You can only delete an uploaded font once no overlay is using it, and the message tells you which overlay still does. Only upload fonts you have the right to use.

## Custom CSS

For anything the settings cannot do, there is one optional CSS box. It is plain CSS: no JavaScript, and a `</style>` in it is discarded. The overlay has these class names to target:

| Class | What it is |
|-------|-----------|
| `.mw-chat` | The whole chat area |
| `.mw-msg` | One message |
| `.mw-badge` | A badge image |
| `.mw-user` | The username |
| `.mw-text` | The message text |
| `.mw-emote` | An emote image |

```css
.mw-msg { border-left: 3px solid #ff6b9d; padding-left: 8px; }
.mw-user { text-transform: uppercase; letter-spacing: 0.05em; }
```

## Troubleshooting

- **The preview works but OBS is blank.** Check the URL was copied in full, and that you did not click **New URL** or delete the overlay since you pasted it. A quiet chat is also blank by design.
- **Emotes show as plain words.** The word has to match the emote name exactly. If you just added the emote, wait up to ten minutes.
- **Creating an overlay says to invite the bot.** Do that once under **Bot → Settings**.
