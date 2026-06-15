---
title: Bot Setup
description: Invite the MapleOverlays bot to your Twitch channel and configure it from the dashboard.
---

The MapleOverlays bot joins your channel via Twitch's OAuth authorization flow. Once invited, a single bot process handles all channels — you don't run anything yourself.

## Invite the Bot

1. Log in to the [dashboard](/dashboard) with your Twitch account.
2. Navigate to **Bot → Settings**.
3. Click **Invite Bot** — you'll be redirected to Twitch to authorize the `channel:bot` scope.
4. After approving, the bot joins your channel automatically.

The bot status indicator on the Settings page shows whether the bot is currently active in your channel.

## Re-authorize

If the bot loses access (expired token, revoked permissions), click **Re-authorize** on the Bot Settings page to go through the OAuth flow again. The bot resumes as soon as the new token is stored.

## Removing the Bot

To remove the bot, type `/ban <bot_login>` or `/block <bot_login>` in your Twitch chat, or revoke the authorization from your [Twitch connections page](https://www.twitch.tv/settings/connections).

## What the Bot Can Do

| Feature | Details |
|---------|---------|
| Built-in commands | `!ping`, `!uptime`, `!song`, `!followage`, `!accountage`, `!watchtime`, `!tip`, `!commands` |
| Custom commands | Create commands with dynamic template responses from the dashboard |
| AutoMod | Optional link filter, caps tax, emote-spam timeout, first-time chatter welcome |
| Watchtime tracking | Accumulates viewer chat session time while the stream is live |

See [Commands](/reference/commands/) for the full command reference.
