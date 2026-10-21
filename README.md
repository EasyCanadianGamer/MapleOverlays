# MapleOverlays

MapleOverlays is a free, open-source Twitch overlay and chat bot service for streamers, and an alternative to StreamElements and PixelChat. You sign in with Twitch, make overlays in a dashboard, and add each one to OBS as a browser source. A chat bot joins your channel and answers commands.

Hosted version: https://mapleoverlays.canadian-gamer.com
Documentation: https://mapleoverlays-docs.canadian-gamer.com/

## What it does

**Overlays**

- Make as many Chat and Now Playing overlays as you want. Each has a name, its own settings and its own OBS URL.
- Chat overlay: shows your Twitch chat with badges and Twitch, 7TV, BetterTTV and FrankerFaceZ emotes. You can change layout, colors, message boxes, animation and filters (hidden users, blocked words, hidden commands), and add custom CSS.
- Now Playing overlay: shows the track playing on your Last.fm account. It can pop up on each new song, only when someone types `!song`, or stay on screen while music plays.
- Fonts: pick a built-in font, any Google Font, or upload your own (woff2, woff, ttf or otf). The Files page lists what you have uploaded and which overlays use it.
- Overlays can be duplicated, renamed, deleted, and given a new URL if the old one leaks.

**Chat bot**

- Built-in commands: `!ping`, `!uptime`, `!song`, `!followage`, `!accountage`, `!watchtime`, `!tip` and `!commands`.
- Custom commands with template variables, plus timers and counters.
- Chat moderation rules.
- Every channel has its own settings. One bot account serves all channels.

**Stream Manager**

- Channel stats and stream title and category editing from the dashboard.

## Why MapleOverlays

| If you want | MapleOverlays |
|---|---|
| An open-source StreamElements alternative | The code is public under AGPL-3.0. Read it, fork it, or host your own copy. |
| A bot under your own name | Self-host it and give the bot its own Twitch account, so it speaks under whatever name you choose. This needs a separate bot account. |
| PixelChat-style features without paying | No paid tier. Everything in this README is free. |
| OBS overlays | Chat and Now Playing overlays, each with its own browser source URL |
| A chat bot | Built-in and custom commands, timers, counters and moderation |
| Data you own | Self-host the whole stack with Docker Compose, so your data stays on your server. Or use the hosted version. |

See the full [comparison](https://docs.mapleoverlays.canadian-gamer.com/compare/) for details.

## Running it yourself

You need Docker with the Compose plugin, a Twitch application ([dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)), and a Last.fm API key ([last.fm/api](https://www.last.fm/api/account/create)) if you want the Now Playing overlay.

```bash
git clone https://github.com/EasyCanadianGamer/MapleOverlays.git
cd MapleOverlays
cp .env.example .env
```

Fill in `.env`. The comments in `.env.example` explain each value. The ones you must set are:

| Variable | What it is |
|---|---|
| `TWITCH_CLIENT_ID`, `VITE_TWITCH_CLIENT_ID` | Client ID of your Twitch application (same value in both) |
| `TWITCH_CLIENT_SECRET` | Client secret of your Twitch application |
| `LASTFM_API_KEY` | Last.fm API key |
| `POSTGRES_PASSWORD` | Password for the bundled Postgres, and the same one inside `DATABASE_URL` |
| `ENCRYPTION_KEY` | Encrypts stored Twitch tokens. Generate with `openssl rand -hex 32` and back it up. Losing it means every channel has to sign in again. |
| `BOT_USER_ID`, `BOT_ACCESS_TOKEN`, `BOT_REFRESH_TOKEN` | The Twitch account the bot speaks as |

In your Twitch application, add two OAuth redirect URLs. They must match your `.env` exactly:

```
http://localhost:5173/auth/twitch/callback
http://localhost:5173/auth/bot/callback
```

Then start everything:

```bash
docker compose up --build -d
```

| Service | Default address |
|---|---|
| Dashboard | http://localhost:5173 |
| API | http://localhost:3099 |
| Docs | http://localhost:4321 |

Ports can be changed with `FRONTEND_PORT`, `API_PORT` and `DOCS_PORT`. The API is also reachable through the dashboard address, because the frontend's nginx proxies it. For a public deployment, put the stack behind a reverse proxy with HTTPS and use your domain in the redirect URLs and in `FRONTEND_URL`.

The self-hosting section of the docs covers this in more detail, including every environment variable.

## Project layout

```
apps/api         Express API: overlays, fonts, chat assets, bot setup, Last.fm
apps/bot         Twitch bot (EventSub, commands, moderation)
apps/frontend    React + Vite dashboard and the overlay pages OBS loads
docs/public      Documentation site (Astro Starlight)
docs/internal    Notes for contributors
packages/lastfm  Last.fm client
packages/shared  Code shared between apps
```

The database is Postgres. Migrations live in `apps/api/migrations` and run when the API starts.

## Development

Requires Node 22.12 or newer, pnpm, and a Postgres database.

```bash
pnpm install
pnpm --filter @maple/frontend dev      # dashboard
pnpm --filter @maple/api dev           # API
pnpm --filter @maple/bot dev           # bot
```

`docs/internal/TESTING.md` describes how to run each service on its own.

Tests:

```bash
pnpm --filter @maple/frontend test
pnpm --filter @maple/bot test
DATABASE_URL=postgres://user:pass@localhost:5432/db pnpm --filter @maple/api test
```

The API tests that touch the database are skipped when `DATABASE_URL` is not set. They apply migrations on start, so run the test files one after another (`node --test --test-concurrency=1`) rather than in parallel.

## License

GNU Affero General Public License v3.0. See [LICENSE.md](LICENSE.md).
