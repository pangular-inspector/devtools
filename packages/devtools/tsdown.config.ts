import { defineConfig, type UserConfig } from 'tsdown';
import {
  BROWSER_ENTRIES,
  NODE_ENTRIES,
  assertBrowserSafe,
  assertHubLoaderStandsAlone,
} from './build/entries.ts';

const shared = {
  external: [/^@angular\//, /^@nativescript\//, /^rxjs/],
  format: 'esm',
  dts: true,
  // The package exports name `.mjs` files, which the browser build would
  // otherwise write as `.js`.
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
} satisfies UserConfig;

/**
 * The browser build. Its own build, so no chunk is shared with the Node
 * entries, and it fails when an entry reaches a Node builtin.
 */
export const browserConfig = {
  ...shared,
  name: 'browser',
  entry: BROWSER_ENTRIES,
  platform: 'browser',
  hooks: {
    'build:done': ({ chunks }) => assertBrowserSafe(chunks),
  },
} satisfies UserConfig;

export const nodeConfig = {
  ...shared,
  name: 'node',
  entry: NODE_ENTRIES,
  platform: 'node',
  hooks: {
    'build:done': ({ chunks }) => assertHubLoaderStandsAlone(chunks),
  },
} satisfies UserConfig;

export default defineConfig([browserConfig, nodeConfig]);
