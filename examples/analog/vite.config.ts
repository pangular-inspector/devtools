import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
import ngDevtools from '@santoshyadavdev/ng-devtools/vite';

export default defineConfig(() => ({
  build: {
    target: ['es2022'],
  },
  resolve: {
    mainFields: ['module'],
    alias: {
      '@santoshyadavdev/ng-devtools/overlay': fileURLToPath(
        new URL('../../packages/ng-devtools/dist/overlay.mjs', import.meta.url),
      ),
      '@santoshyadavdev/ng-devtools/http': fileURLToPath(
        new URL('../../packages/ng-devtools/dist/http.mjs', import.meta.url),
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
    ngDevtools(),
  ],
}));
