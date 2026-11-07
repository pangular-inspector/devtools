import { defineConfig, type UserConfig } from 'tsdown';
import {
  BROWSER_ENTRIES,
  NODE_ENTRIES,
  assertBrowserSafe,
  LOADER_ENTRIES,
  assertLoaderStandsAlone,
} from './build/entries.ts';

const shared = {
  external: [/^@angular\//, /^@nativescript\//, /^rxjs/],
  format: 'esm',
  // `@internal` declarations stay out of the published types: they are exported for the
  // package's own modules, not for apps.
  dts: { compilerOptions: { stripInternal: true } },
  // The package exports name `.mjs` files, which the browser build would
  // otherwise write as `.js`.
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
} satisfies UserConfig;

/**
 * Sources the browser source maps put in their ignore list, so DevTools skips
 * their frames in stack traces and console call sites. The console tap wraps
 * `console.*`, and without this every `console.log` in the app names the
 * wrapper as its caller (#369). `node_modules` is Rolldown's default.
 */
export const IGNORED_SOURCES = /node_modules|[\\/]console-tap\.ts$/;

const nodeExternal = [/^@angular\/(?!compiler$)/, /^@nativescript\//, /^rxjs/];

/**
 * The browser build. Its own build, so no chunk is shared with the Node
 * entries, and it fails when an entry reaches a Node builtin.
 */
export const browserConfig = {
  ...shared,
  name: 'browser',
  entry: BROWSER_ENTRIES,
  platform: 'browser',
  // Source maps ship with the browser entries, so the browser, or the app's
  // bundler, reads the ignore list.
  sourcemap: true,
  outputOptions: { sourcemapIgnoreList: IGNORED_SOURCES },
  hooks: {
    'build:done': ({ chunks }) => assertBrowserSafe(chunks),
  },
} satisfies UserConfig;

export const nodeConfig = {
  ...shared,
  external: nodeExternal,
  name: 'node',
  entry: NODE_ENTRIES,
  platform: 'node',
  hooks: {
    'build:done': ({ chunks }) => {
      for (const entry of LOADER_ENTRIES) assertLoaderStandsAlone(chunks, entry);
    },
  },
} satisfies UserConfig;

/**
 * The `ng add` schematic, as CommonJS: the Angular CLI loads schematic
 * factories with `require()`. Its JSON files are copied next to it, and
 * `schematics` in `package.json` points at the collection.
 */
export const schematicsConfig = {
  name: 'schematics',
  entry: { 'schematics/ng-add/index': 'src/schematics/ng-add/index.ts' },
  format: 'cjs',
  platform: 'node',
  dts: false,
  external: [/^@angular-devkit\//],
  outExtensions: () => ({ js: '.cjs' }),
  copy: (resolved) => [
    { from: 'src/schematics/collection.json', to: `${resolved.outDir}/schematics` },
    { from: 'src/schematics/ng-add/schema.json', to: `${resolved.outDir}/schematics/ng-add` },
  ],
} satisfies UserConfig;

export default defineConfig([browserConfig, nodeConfig, schematicsConfig]);
