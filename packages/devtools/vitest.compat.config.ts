import { createRequire } from 'node:module';
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.ts';
import { signalPrimitivesAlias } from './src/vite-signals-stub.ts';

const require = createRequire(import.meta.url);
const angular = Number(require('@angular/core/package.json').version.split('.')[0]);

const pageSide = [
  'analog-scan',
  'angular-real-app',
  'cd-recorder',
  'cd-recorder-real',
  'change-detection',
  'change-detection-real',
  'component-tree',
  'console-tap',
  'defer-blocks',
  'defer-blocks-real',
  'errors-collector',
  'errors-real',
  'forms',
  'forms-tools',
  'host-tree',
  'http',
  'http-cache-key',
  'http-server',
  'injector-tree',
  'injector-tree-real',
  'ngrx-collector',
  'pipes-collector',
  'pipes-runtime',
  'private-api-canary',
  'router-actions-wait',
  'router-angular20',
  'router-audit',
  'router-features',
  'router-forroot',
  'router-guard-results',
  'router-loops',
  'router-real',
  'router-setup-legacy',
  'router-setup-real',
  'router-shared-guards',
  'signal-graph-real',
  'signal-peek',
  'signal-resources',
];

const signalForms = [
  'forms-actions',
  'forms-audit',
  'forms-collector',
  'forms-instrument',
  'forms-read',
  'forms-real',
  'forms-source',
];

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: [...pageSide, ...(angular >= 22 ? signalForms : [])].map(
        (name) => `src/__tests__/${name}.test.ts`,
      ),
      setupFiles: angular >= 21 ? [] : ['src/__tests__/zone-setup.ts'],
    },
    // What the Vite plugin does for an app before Angular 17, which has no
    // `@angular/core/primitives/signals` for the signal write hook to import.
    resolve: { alias: signalPrimitivesAlias(import.meta.dirname) },
  }),
);
