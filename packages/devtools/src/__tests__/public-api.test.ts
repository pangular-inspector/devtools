import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BROWSER_ENTRIES, NODE_ENTRIES } from '../../build/entries.ts';

// The published `devframe` entry loads the built definition from the installed package; here it
// gets the sources instead, which have no build to load.
vi.mock('../devframe-entry.ts', async () => {
  const source = await import('../entries/devframe.ts');
  return { loadDevframeServer: () => source };
});

// The values each entry point exports at runtime. Everything an entry exports is frozen by semver
// from 1.0, so a new export is a deliberate change to this list and to the docs that cover it.
// Types are checked by the published `.d.mts` files (`stripInternal` drops `@internal` ones).
const PUBLIC_VALUES: Record<string, string[]> = {
  config: [
    'DEFAULT_POPUP_HOTKEY',
    'PANGULAR_ACTIONS',
    'PANGULAR_INSPECTORS',
    'PANGULAR_LIMITS',
    'resolvePangularConfig',
  ],
  devframe: [
    'DEFAULT_POPUP_HOTKEY',
    'PANGULAR_ACTIONS',
    'PANGULAR_INSPECTORS',
    'PANGULAR_LIMITS',
    'createPangular',
    'default',
    'initDevframe',
    'resolvePangularConfig',
  ],
  hub: ['PANGULAR_HUB_BASE', 'hubEnabled', 'initPangularHub'],
  vite: ['default'],
  cli: ['createPangularCli'],
  http: ['providePangularHttp', 'withPangular'],
};

const packageDir = join(import.meta.dirname, '../..');
const entries: Record<string, string> = { ...BROWSER_ENTRIES, ...NODE_ENTRIES };

describe('the public API of each entry point', () => {
  for (const [name, expected] of Object.entries(PUBLIC_VALUES)) {
    it(`./${name} exports only its documented values`, async () => {
      const module = (await import(join(packageDir, entries[name]!))) as Record<string, unknown>;
      expect(Object.keys(module).sort()).toEqual([...expected].sort());
    });
  }

  it('exposes the same hub names inside the workspace as in the published package', async () => {
    const source = (await import('../entries/hub-source.ts')) as Record<string, unknown>;
    expect(Object.keys(source).sort()).toEqual([...PUBLIC_VALUES['hub']!].sort());
  });

  it('exposes the same devframe names inside the workspace as in the published package', async () => {
    const source = (await import('../entries/devframe.ts')) as Record<string, unknown>;
    expect(Object.keys(source).sort()).toEqual([...PUBLIC_VALUES['devframe']!].sort());
  });

  it('points the workspace exports at the same entry files the build publishes', () => {
    const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
      exports: Record<string, string>;
      publishConfig: { exports: Record<string, string> };
    };
    for (const name of ['config', 'vite', 'cli', 'http']) {
      expect(manifest.exports[`./${name}`]).toBe(`./${entries[name]}`);
    }
    // The published `devframe` entry is a loader; the workspace points at what it loads.
    expect(manifest.exports['./devframe']).toBe(`./${entries['devframe-server']}`);
    expect(manifest.exports['.']).toBe(`./${entries['devframe-server']}`);
    // Internals are a workspace convenience, never published.
    expect(manifest.exports['./internal/config']).toBeDefined();
    expect(
      Object.keys(manifest.publishConfig.exports).some((key) => key.includes('internal')),
    ).toBe(false);
  });
});
