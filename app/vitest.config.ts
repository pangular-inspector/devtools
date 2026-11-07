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
    // Used only with `--coverage` (`pnpm test:coverage`): a report, with no threshold to meet.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/test-setup.ts'],
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      reportOnFailure: true,
      reportsDirectory: '../dist/coverage/panel',
    },
  },
});
