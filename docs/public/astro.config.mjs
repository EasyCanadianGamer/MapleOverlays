import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeFlexoki from 'starlight-theme-flexoki'


export default defineConfig({
  integrations: [
    starlight({
      plugins: [starlightThemeFlexoki()],
      title: 'MapleOverlays',
      description: 'Twitch overlay and bot service for streamers.',
      logo: {
        src: './src/assets/logo-mark-white.png',
        alt: 'MapleOverlays',
        replacesTitle: false,
      },
      favicon: '/favicon.png',
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
            { label: 'Overlays', slug: 'guides/overlays' },
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
