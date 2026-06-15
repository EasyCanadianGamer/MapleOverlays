---
title: Self-Hosting Overview
description: Run your own MapleOverlays instance — full control, no shared infrastructure.
---

MapleOverlays is designed to be self-hosted. The entire stack runs from a single `docker compose up` command. You own your data, your tokens, and your uptime.

## What You Get

| Component | What it does |
|-----------|-------------|
| **API** | Express server — bot OAuth, command CRUD, settings, `/nowplaying` proxy |
| **Bot** | Multi-tenant Twitch EventSub WebSocket bot |
| **Frontend** | React SPA served via nginx |
| **Postgres** | All persistent state — channels, commands, watchtimes |

## Requirements

- A Linux server (VPS, home server, etc.) with Docker and Docker Compose installed
- A domain name pointed at your server (for Twitch OAuth redirect URIs)
- A [Twitch Developer Application](https://dev.twitch.tv/console/apps) registered with your redirect URIs
- A [Last.fm API key](https://www.last.fm/api/account/create) if you want now-playing support (optional)

## Quick Start

```bash
git clone https://github.com/easycanadiangamer/MapleOverlays.git
cd MapleOverlays
cp .env.example .env
# Edit .env with your values — see Environment Variables
docker compose up --build -d
```

The API runs database migrations on startup, so the order is handled automatically (`api` and `bot` depend on a healthy `postgres`).

## Architecture Notes

- The **API must start before the bot** on a fresh database — it creates all tables via migrations. `docker compose` handles this via `depends_on` health checks.
- **Tokens are encrypted at rest** using AES-256-GCM. Generate a fresh `ENCRYPTION_KEY` for your instance: `openssl rand -hex 32`.
- The bot process is **stateless across restarts** except for in-flight watchtime data, which is flushed to Postgres on `SIGTERM`. Docker's default stop timeout (10s) is sufficient.
- All services communicate over an internal Docker bridge network (`maple_net`) — only the API and frontend ports need to be exposed to the internet.

## Ports

| Service | Default port | Env var to change |
|---------|-------------|-------------------|
| API | 3000 | `API_PORT` |
| Frontend | 5173 | `FRONTEND_PORT` |
| Docs | 4321 | `DOCS_PORT` |
| Postgres | not exposed | — |

## Next Steps

- [Docker Compose guide](/self-hosting/docker/) — step-by-step setup
- [Environment variables](/self-hosting/environment/) — full reference
