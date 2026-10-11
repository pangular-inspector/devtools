import { createRequire } from 'node:module';
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.ts';

const require = createRequire(import.meta.url);
const angular = Number(require('@angular/core/package.json').version.split('.')[0]);

const pageSide = [
  'analog-scan',
  'forms',
  'forms-tools',
  'http',
  'http-cache-key',
  'ngrx-collector',
  'pipes-collector',
  'pipes-runtime',
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
  }),
);
