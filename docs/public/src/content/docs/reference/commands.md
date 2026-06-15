---
title: Commands
description: Full reference for all built-in MapleOverlays bot commands and how to create custom ones.
---

All commands are prefixed with `!`. Built-in commands are always available; they can be disabled per-channel from the dashboard but cannot be deleted.

## Built-in Commands

| Command | Description |
|---------|-------------|
| `!ping` | Replies `pong` — useful for checking if the bot is active. |
| `!uptime` | Reports how long the stream has been live. Replies with a "stream is offline" message if not live. |
| `!song` | Shows the track currently scrobbling on the channel's Last.fm account. Requires a Last.fm username set in Settings. |
| `!followage` | Tells the chatter how long they've been following the channel. |
| `!accountage` | Tells the chatter how long their Twitch account has existed. |
| `!watchtime` | Reports the chatter's accumulated watchtime in this channel. |
| `!tip` | Posts the channel's tip/donation link. Requires a tip URL set in Settings. |
| `!commands` | Links to the public command list page for the channel. |

## Enabling / Disabling Commands

Each built-in command can be toggled on or off per-channel from the **Bot → Commands** page in the dashboard. Disabled commands are silently ignored — the bot won't reply.

## Custom Commands

You can create your own commands from the **Bot → Commands** page. A custom command has:

- **Command name** — lowercase letters, numbers, and underscores; max 20 characters (the `!` is added automatically).
- **Response** — the message the bot sends; supports [template variables](/reference/template-variables/).

Custom commands cannot share a name with a built-in command.

### Example

A custom `!discord` command with response `Join our Discord at discord.gg/example` will reply with that text whenever someone types `!discord` in chat.

## Public Command List

Viewers can see your channel's enabled commands at `/commands/<your_twitch_login>` — no login required.
