import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  root: import.meta.dirname,
  css: {
    preprocessorOptions: {
      scss: { loadPaths: [join(import.meta.dirname, 'src/styles')] },
    },
  },
  plugins: [
    angular({
      tsconfig: join(import.meta.dirname, 'tsconfig.json'),
      inlineStylesExtension: 'scss',
      jit: false,
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    execArgv: ['--no-experimental-webstorage'],
  },
});
