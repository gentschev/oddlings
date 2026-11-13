import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { PALETTE } from './src/game/constants';
import { buildVersion } from './tools/buildVersion';
import { parseChannel, storageNames } from './src/platform/channel';
import { isolateNextWorkbox } from './tools/channelWorker';

const channel = parseChannel(process.env.ODDLINGS_CHANNEL), names = storageNames(channel);

export default defineConfig({
  base: './',
  define: { __BUILD_VERSION__: JSON.stringify(buildVersion()), __ODDLINGS_CHANNEL__: JSON.stringify(channel) },
  build: { target: 'es2022', rollupOptions: { input: { game: 'index.html', parent: 'parent.html' } } },
  server: { host: true, port: 5199, strictPort: true },
  preview: { host: true, port: 5199, strictPort: true },
  plugins: [VitePWA({
    strategies: 'generateSW',
    registerType: 'autoUpdate',
    injectRegister: false,
    scope: './',
    includeAssets: ['icons/*.png'],
    manifest: {
      name: channel === 'next' ? 'Oddlings Test' : 'Oddlings', short_name: channel === 'next' ? 'Odd Test' : 'Oddlings', display: 'fullscreen', orientation: 'landscape',
      start_url: './', scope: './', background_color: PALETTE.cream, theme_color: PALETTE.cream,
      icons: [
        { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      cacheId: channel === 'next' ? 'workbox-next' : undefined,
      skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true,
      globPatterns: ['**/*.{html,js,css,png,jpg,jpeg,json,ttf,webmanifest}'],
      globIgnores: ['**/assets/speech/**'],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      // Public art and fonts keep their names, so they need content revisions too.
      dontCacheBustURLsMatching: /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css|ttf)$/,
      // Directory launches need an index fallback. Explicit parent.html uses its precache entry.
      navigateFallback: 'index.html', navigateFallbackDenylist: [/\/parent\.html(?:\?|$)/, /\/assets\//],
      runtimeCaching: [
        { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('/assets/speech/index.json'), handler: 'NetworkFirst',
          options: { cacheName: names.speechIndex, networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] },
            plugins: [{ cacheWillUpdate: async ({ response }) => response.status === 200 && response.headers.get('content-type')?.includes('application/json') ? response : null }] } },
        { urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/speech\/[^/]+\.m4a$/.test(url.pathname), handler: 'CacheFirst',
          options: { cacheName: names.speech, cacheableResponse: { statuses: [200] }, rangeRequests: true,
            expiration: { maxEntries: 1200, maxAgeSeconds: 365 * 24 * 60 * 60 },
            plugins: [{ cacheWillUpdate: async ({ response }) => response.status === 200 && !response.headers.get('content-type')?.includes('text/html') ? response : null }] } },
      ],
    },
  }), ...(channel === 'next' ? [{ name: 'oddlings-next-workbox', apply: 'build' as const,
    closeBundle: { order: 'post' as const, sequential: true, handler: () => isolateNextWorkbox('dist') } }] : [])],
});
