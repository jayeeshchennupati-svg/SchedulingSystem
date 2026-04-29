import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const repo = process.env.GITHUB_REPOSITORY;
  const base = repo ? `/${repo.split('/')[1]}/` : '/';

  return {
    base,
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon-192.png', 'icon-512.png', 'icon-152.png'],
        manifest: {
          name: 'The Antechamber',
          short_name: 'Antechamber',
          description: 'Audience Queue Management System for the President',
          theme_color: '#0a0d14',
          background_color: '#0a0d14',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icon-72.png',  sizes: '72x72',   type: 'image/png' },
            { src: 'icon-96.png',  sizes: '96x96',   type: 'image/png' },
            { src: 'icon-128.png', sizes: '128x128', type: 'image/png' },
            { src: 'icon-144.png', sizes: '144x144', type: 'image/png' },
            { src: 'icon-152.png', sizes: '152x152', type: 'image/png' },
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: 'icon-384.png', sizes: '384x384', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  };
});
