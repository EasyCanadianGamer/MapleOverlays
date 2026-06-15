# Testing Each Service Locally

## Prerequisites

All services share a root `.env` file. Copy and fill it in before starting:

```bash
cp .env.example .env
```

Required variables per service are noted below.

---

## API (`apps/api`)

**Requires:** `LASTFM_API_KEY`

```bash
cd apps/api
pnpm dev
```

The server starts on port 3000 by default. Test it with curl:

```bash
# Happy path — user is currently playing something
curl "http://localhost:3000/nowplaying?user=<lastfm-username>"
# → Now playing: Song Name by Artist

# User exists but not playing anything
curl "http://localhost:3000/nowplaying?user=<lastfm-username>"
# → Not currently playing anything

# Missing user param
curl "http://localhost:3000/nowplaying"
# → Error: Missing required query parameter: user

# User not found
curl "http://localhost:3000/nowplaying?user=thisuserdoesnotexist99999"
# → Error: User not found
```

---

## Bot (`apps/bot`)

**Requires:** `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `BOT_USER_ID`, `BOT_ACCESS_TOKEN`, `DATABASE_URL`

The bot uses the Twitch EventSub WebSocket transport to receive chat events and the Helix API (`POST /helix/chat/messages`) to send messages. There is no IRC/tmi.js connection.

Get a user access token for the bot account with the `user:bot` scope by performing a manual OAuth flow at dev.twitch.tv, then set `BOT_ACCESS_TOKEN` in your `.env`.

```bash
cd apps/bot
pnpm dev
```

Confirm the connection in the log output — the bot will establish a WebSocket connection to EventSub and subscribe to chat events for the configured channel.

Then open the Twitch channel in a browser and type in chat:

| Command | Expected response |
|---------|-------------------|
| `!ping` | `pong!`           |

---

## Frontend (`apps/frontend`)

**Requires:** Nothing — runs standalone.

```bash
cd apps/frontend
pnpm dev
```

Open http://localhost:5173 in a browser. You should see the MapleOverlays heading.

---

## Postgres only (for local dev)

To run just the database without the full Docker stack:

```bash
cd test-docker
POSTGRES_PASSWORD=yourpassword docker compose up -d
```

Connection string to use in `.env`:
```
DATABASE_URL=postgresql://maple:yourpassword@localhost:5432/maple
```
