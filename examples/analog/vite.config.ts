import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';

export default defineConfig(() => ({
  build: {
    target: ['es2022'],
  },
  resolve: {
    mainFields: ['module'],
    alias: {
      '@pangular-inspector/devtools/overlay': fileURLToPath(
        new URL('../../packages/devtools/dist/overlay-auto.mjs', import.meta.url),
      ),
      '@pangular-inspector/devtools/http': fileURLToPath(
        new URL('../../packages/devtools/dist/http.mjs', import.meta.url),
      ),
    },
  },
  plugins: [
    analog({
      prerender: {
        routes: [
          '/',
          '/pricing',
          '/about',
          '/blog',
          '/blog/why-we-built-on-analog',
          '/docs',
          '/docs/shipping',
        ],
      },
      nitro: {
        routeRules: {
          '/dashboard': { ssr: false },
        },
      },
      content: {
        highlighter: 'prism',
      },
    }),
    pangular(),
  ],
}));
