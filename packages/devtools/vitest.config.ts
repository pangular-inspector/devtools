import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node 25+ ships its own `localStorage` global, which is `undefined` without
    // `--localstorage-file` and hides the jsdom one the tests rely on.
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/__tests__/test-env.ts'],
    // The Windows runner is several times slower at the tests that run a full
    // devframe setup (the Analog source scan, the agent tools), and they hit the
    // 5 s default there while taking under 100 ms on Linux.
    testTimeout: process.platform === 'win32' ? 20_000 : 5_000,
    // Used only with `--coverage` (`pnpm test:coverage`): a report, with no threshold to meet.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      reportOnFailure: true,
      reportsDirectory: '../../dist/coverage/devtools',
    },
  },
});
