# MapleOverlays

A lightweight Node.js API that returns a plain-text now-playing status from Last.fm. Foundation for a streamer overlay service.

## Usage

```
GET /nowplaying?user=<lastfm-username>
```

**Responses:**
```
Now playing: Bohemian Rhapsody by Queen
Not currently playing anything
Error: User not found
```

## Setup

```bash
cp .env.example .env
# Add your Last.fm API key to .env
npm install
npm start
```

Get a free API key at [last.fm/api](https://www.last.fm/api/account/create).

## Docker

```bash
docker compose up --build
```

Change the port without touching any files:

```bash
PORT=8080 docker compose up --build
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LASTFM_API_KEY` | Yes | — | Your Last.fm API key |
| `PORT` | No | `3000` | Port the server listens on |
