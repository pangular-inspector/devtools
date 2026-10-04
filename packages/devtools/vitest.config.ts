import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node 25+ ships its own `localStorage` global, which is `undefined` without
    // `--localstorage-file` and hides the jsdom one the tests rely on.
    execArgv: ['--no-experimental-webstorage'],
  },
});
