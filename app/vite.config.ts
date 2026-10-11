import { join } from 'node:path';
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { devframeViteBridge } from '@devframes/vite/single';
import pangular from '@pangular-inspector/devtools/devframe';

export default defineConfig({
  base: './',
  root: import.meta.dirname,
  build: { outDir: '../dist/devtools-ui', emptyOutDir: true },
  css: {
    preprocessorOptions: {
      scss: { loadPaths: [join(import.meta.dirname, 'src/styles')] },
    },
  },
  optimizeDeps: {
    entries: [],
    exclude: [
      '@angular/core',
      '@angular/common',
      '@angular/platform-browser',
      '@angular/compiler',
      '@angular/router',
    ],
  },
  plugins: [
    angular({
      tsconfig: join(import.meta.dirname, 'tsconfig.json'),
      inlineStylesExtension: 'scss',
    }),
    devframeViteBridge(pangular, { base: '/__pangular/', auth: false }),
  ],
});
