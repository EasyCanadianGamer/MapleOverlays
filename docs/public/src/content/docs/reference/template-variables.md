---
title: Template Variables
description: Dynamic variables you can use in custom command response templates.
---

Custom command responses support `{variable}` placeholders that the bot resolves at runtime. Variables are fetched lazily — only the variables that appear in the template make API calls.

## Available Variables

| Variable | Resolves to |
|----------|-------------|
| `{channel}` | The broadcaster's Twitch login name |
| `{user}` | The chatter's Twitch login name |
| `{1}` | The first word typed after the command (the "argument") |
| `{game}` | The game the channel is currently streaming (falls back to channel info if offline) |
| `{channel.game}` | Same as `{game}` |
| `{channel.viewers}` | Current live viewer count |
| `{1.game}` | The game being streamed by the channel named in `{1}` |
| `{user.follow}` | How long the chatter has been following this channel (e.g. `3 months`) |
| `{user.subscribe}` | The chatter's sub tier (`Tier 1`, `Tier 2`, `Tier 3`) or `[not subscribed]` |

## Examples

```
Current game: {game}
→ "Current game: Minecraft"

{user} has been following for {user.follow}!
→ "StreamerFan has been following for 2 years!"

!lurk response: {user} is now lurking. They were watching {channel} play {game}.
→ "coolguy is now lurking. They were watching mystream play Just Chatting."
```

## Notes

- If an API call fails (e.g. Twitch is down), the variable resolves to an empty string rather than crashing.
- `{1}` is empty if the viewer types the command with no argument.
- `{1.game}` looks up the channel named in `{1}`, so `!game minecraft` would try to look up a channel called "minecraft".
