import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeFlexoki from 'starlight-theme-flexoki'


export default defineConfig({
  site: 'https://docs.mapleoverlays.canadian-gamer.com',
  integrations: [
    starlight({
      plugins: [starlightThemeFlexoki()],
      title: 'MapleOverlays',
      description: 'Docs for MapleOverlays, a free open-source Twitch overlay and chat bot, and alternative to StreamElements and PixelChat.',
      logo: {
        src: './src/assets/logo-mark-white.png',
        alt: 'MapleOverlays',
        replacesTitle: false,
      },
      favicon: '/favicon.png',
      head: [
        { tag: 'meta', attrs: { name: 'keywords', content: 'streamelements alternative, pixelchat alternative, open source twitch overlay, twitch chat bot, obs browser source, self-hosted twitch bot' } },
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'MapleOverlays Docs' } },
      ],
      customCss: ['./src/styles/custom.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/easycanadiangamer/MapleOverlays',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: '' },
            { label: 'Bot Setup', slug: 'guides/bot-setup' },
            { label: 'Compare', slug: 'compare' },
          ],
        },
        {
          label: 'Overlays',
          items: [
            { label: 'Managing Overlays', slug: 'guides/managing-overlays' },
            { label: 'Chat Overlay', slug: 'guides/chat-overlay' },
            { label: 'Now Playing', slug: 'guides/nowplaying-overlay' },
            { label: 'Future Overlays', slug: 'guides/future-overlays' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Commands', slug: 'reference/commands' },
            { label: 'Template Variables', slug: 'reference/template-variables' },
          ],
        },
        {
          label: 'Self-Hosting',
          items: [
            { label: 'Overview', slug: 'self-hosting' },
            { label: 'Docker Compose', slug: 'self-hosting/docker' },
            { label: 'Environment Variables', slug: 'self-hosting/environment' },
          ],
        },
      ],
    }),
  ],
});
