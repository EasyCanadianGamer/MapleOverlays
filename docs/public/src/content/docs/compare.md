---
title: MapleOverlays vs StreamElements and PixelChat
description: MapleOverlays is a free, open-source alternative to StreamElements and PixelChat. See what it does today, how self-hosting gives you a bot with your own name, and what is planned.
---

MapleOverlays is a free, open-source alternative to StreamElements and PixelChat for Twitch streamers. You get a chat overlay, a Last.fm now playing overlay and a chat bot with custom commands, timers, counters and moderation. Use the hosted version, or run your own copy.

## Why people switch

**Open source.** The code is public under AGPL-3.0. You can read it, change it, fork it and host your own copy.

**Data you own.** When you self-host, your channel data, settings and tokens live on your own server, not someone else's.

**A bot with your own name.** Self-host MapleOverlays, create a separate Twitch account for the bot, and it speaks as that account. Change the name by changing the account.

**No paid tier.** MapleOverlays has no premium plan. Every feature below is free, which is the main difference from PixelChat, whose premium features sit behind a subscription.

## What you get today

| Feature | Details |
|---|---|
| Chat overlay | Twitch chat with badges and Twitch, 7TV, BetterTTV and FrankerFaceZ emotes. Change layout, colors, message boxes and animation. Filter hidden users, blocked words and commands. Add custom CSS. |
| Now Playing overlay | Shows the track playing on your Last.fm account. It can pop up on each new song, only on `!song`, or stay on screen while music plays. |
| Many overlays | Make as many as you want. Each has its own settings and its own OBS browser source URL. |
| Custom fonts | Built-in fonts, any Google Font, or upload your own (woff2, woff, ttf, otf). |
| Chat bot | Built-in commands, custom commands with template variables, timers and counters. |
| Moderation | Chat moderation rules for links, caps, emote spam and more. |
| Stream manager | Channel stats and stream title and category editing from the dashboard. |
| Self-hosting | Docker Compose setup. Your data and your bot account stay yours. |

## Hosted or self-hosted

| | Hosted | Self-hosted |
|---|---|---|
| Setup | Sign in with Twitch and invite the bot | Run the Docker stack with your own Twitch app |
| Bot name | The shared MapleOverlays bot | Any name, using your own bot account |
| Cost | Free | Your own server costs |

For the bot name option you need a separate Twitch account for the bot. See [Self-Hosting](/self-hosting/) to get started.

## Moving over

1. Sign in on the [dashboard](https://mapleoverlays.canadian-gamer.com/dashboard) with Twitch.
2. [Invite the bot](/guides/bot-setup/) to your channel.
3. [Make an overlay](/guides/managing-overlays/) and add its URL to OBS as a browser source.
4. Recreate your chat commands as [custom commands](/reference/commands/). The [template variables](/reference/template-variables/) cover dynamic replies.

## Planned

MapleOverlays covers the features its maintainer needed first: the overlays and bot above. More features are planned, and you can follow progress or suggest ideas on [GitHub](https://github.com/EasyCanadianGamer/MapleOverlays).

## FAQ

**Is there a free, open-source alternative to StreamElements?**
Yes. MapleOverlays is free and open source, with a chat overlay, now playing overlay and a chat bot.

**Is there a free alternative to PixelChat?**
MapleOverlays offers a chat overlay and related tools with no paid tier.

**Can I rename the bot?**
When self-hosting, yes. The bot uses whichever Twitch account you give it, so create a separate account with the name you want.

**Does it work with OBS?**
Yes. Each overlay is a URL you add as a browser source in OBS.

**Which emotes does the chat overlay support?**
Twitch, 7TV, BetterTTV and FrankerFaceZ.
