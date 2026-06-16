---
title: Docker Compose Setup
description: Step-by-step guide to running MapleOverlays with Docker Compose.
---

import { Steps, Aside } from '@astrojs/starlight/components';

<Steps>

1. **Clone the repository**

   ```bash
   git clone https://github.com/easycanadiangamer/MapleOverlays.git
   cd MapleOverlays
   ```

2. **Create your environment file**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and fill in all required values. See [Environment Variables](/self-hosting/environment/) for a full reference.

3. **Register a Twitch Application**

   Go to the [Twitch Developer Console](https://dev.twitch.tv/console/apps) and create a new application.

   - **OAuth Redirect URLs** — add two entries:
     - `https://your-domain.com/auth/twitch/callback` (frontend user login)
     - `https://your-domain.com/auth/bot/callback` (bot channel invite)
   - Copy the **Client ID** and **Client Secret** into `.env`

4. **Generate an encryption key**

   ```bash
   openssl rand -hex 32
   ```

   Paste the output as `ENCRYPTION_KEY` in `.env`. This key encrypts all Twitch OAuth tokens stored in the database. **Back it up** — losing it means all channels need to re-authorize.

5. **Build and start the stack**

   ```bash
   docker compose up --build -d
   ```

   On first run this:
   - Builds all four images (api, bot, frontend, docs)
   - Starts Postgres, waits for it to be healthy
   - Starts the API (runs migrations) and bot in parallel
   - Starts the frontend and docs nginx servers

6. **Verify it's running**

   ```bash
   docker compose ps
   docker compose logs api --tail 20
   ```

   You should see `Listening on port 3000` from the API and `Connected to EventSub` from the bot.

</Steps>

## Updating

```bash
git pull
docker compose up --build -d
```

The API applies any new migrations automatically on startup.

## Reverse Proxy (Recommended)

In production, put a reverse proxy (nginx, Caddy, Traefik) in front of the containers to handle TLS and route traffic:

| Path / hostname | Upstream |
|----------------|---------|
| `your-domain.com` (frontend + API) | `localhost:5173` |
| `docs.your-domain.com` | `localhost:4321` |

The frontend nginx container automatically proxies API paths (`/bot/`, `/auth/bot/`, `/settings`, `/channels/`, `/nowplaying`) to the API container internally — you only need to expose the frontend port publicly. Set both `VITE_API_URL` and `FRONTEND_URL` to your domain (e.g. `https://your-domain.com`).

<Aside type="caution">
Do not change `TWITCH_BOT_CALLBACK_URI` after channels have already authorized — existing tokens will still work but new invites will fail.
</Aside>

## Data Persistence

Postgres data is stored in the `postgres_data` Docker volume. To back up:

```bash
docker compose exec postgres pg_dump -U maple maple > backup.sql
```

To restore:

```bash
docker compose exec -T postgres psql -U maple maple < backup.sql
```

## Stopping / Removing

```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # stop containers AND delete all data
```
