---
title: Managing Overlays
description: Add, rename, duplicate and delete chat and Now Playing overlays, and get each one's OBS URL.
---

An overlay is a transparent web page that you add to OBS as a Browser Source. MapleOverlays lets you make as many as you like, of two kinds: **chat** overlays and **Now Playing** overlays. Each one has its own name, its own settings and its own URL, so you can keep a busy chat for gameplay and a minimal one for just chatting, or a different Now Playing card for every scene.

:::note
The dashboard needs to know your channel, so invite the bot once under **Bot → Settings** before you create overlays. See [Bot Setup](/guides/bot-setup/).
:::

## The Overlays page

Open **Overlays** in the dashboard. A new account starts with an empty page. Every overlay you make is a card showing its name, its kind, its description and when it last changed, with four buttons: **Edit**, **Copy URL**, **Duplicate** and **Delete**.

## Add an overlay

1. Click **Add overlay**.
2. Choose **Chat overlay** or **Now Playing overlay**.
3. The new overlay opens in its editor with a default name: "Chat overlay" or "Now Playing", then "Chat overlay 2", "Chat overlay 3" and so on.

## Edit an overlay

Each overlay has its own editor with a live preview. The **Info** card at the top holds the overlay's name and description, which only label it on the Overlays page. Below it are the settings for that kind, described in [Chat Overlay](/guides/chat-overlay/) and [Now Playing](/guides/nowplaying-overlay/). Click **Save changes** to save the name, description and settings together. Saved changes reach OBS within about 15 seconds, with no refresh.

## Get the OBS URL

**Copy URL** on a card (or in the editor) copies the overlay's address. In OBS, add a **Browser Source**, paste the URL and set the size to your canvas, usually 1920 × 1080. The background is transparent.

Every overlay has a different URL. Anyone who has a URL can see that overlay, so treat it like a stream key for the page. In the editor, **New URL** replaces that one overlay's URL: the old one stops working immediately and your other overlays are not affected.

## Duplicate an overlay

**Duplicate** makes a copy with the same settings and description, a new name ("Stage chat copy", then "Stage chat copy 2") and its own new URL. It is the quickest way to make a variation. Changing the copy never changes the original.

## Delete an overlay

**Delete** asks you to confirm, then removes the overlay. Its URL stops working immediately. Any custom fonts you uploaded stay in your font library; you can delete a font once no overlay uses it.

## Limits and shared settings

- You can have up to 20 overlays, in any mix of the two kinds.
- A name is 1 to 60 characters and a description up to 300.
- Your Last.fm username is one value for your whole channel. Every Now Playing overlay uses it, and so does the **Settings** page.
- `!song` triggers all of your Now Playing overlays at once. Each one then follows its own settings, for example "only trigger on command".
- Uploaded fonts are shared: any of your overlays can use any of your fonts.
