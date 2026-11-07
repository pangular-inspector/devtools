import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

type Manifest = Record<string, unknown>;
interface FirefoxScript {
  GECKO_ID: string;
  GECKO_MIN_VERSION: string;
  firefoxManifest(chrome: Manifest): Manifest;
  buildFirefoxExtension(paths: { from: string; to: string }): Manifest;
}

const extension = join(import.meta.dirname, '../../../../extension');
const script = new URL('../../../../scripts/extension-firefox.mjs', import.meta.url).href;
const load = async () => (await import(/* @vite-ignore */ script)) as FirefoxScript;
const chrome = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8')) as Manifest;

describe('Firefox extension build', () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('writes a Firefox manifest: gecko settings, no Chrome-only keys, the rest unchanged', async () => {
    const { firefoxManifest, GECKO_ID, GECKO_MIN_VERSION } = await load();
    const manifest = firefoxManifest(chrome);
    expect(manifest['key']).toBeUndefined();
    expect(manifest['minimum_chrome_version']).toBeUndefined();
    expect(manifest['browser_specific_settings']).toEqual({
      gecko: {
        id: GECKO_ID,
        strict_min_version: GECKO_MIN_VERSION,
        data_collection_permissions: { required: ['none'] },
      },
    });
    expect(GECKO_ID).toMatch(/^[\w.-]+@[\w.-]+$/);
    const { key, minimum_chrome_version, ...shared } = chrome;
    void key;
    void minimum_chrome_version;
    const { browser_specific_settings, ...rest } = manifest;
    void browser_specific_settings;
    expect(rest).toEqual(shared);
    expect(manifest['manifest_version']).toBe(3);
    // The Chrome manifest is left as it was.
    expect(chrome['key']).toBeTypeOf('string');
  });

  it('runs a background service worker as a background script', async () => {
    const { firefoxManifest } = await load();
    const manifest = firefoxManifest({
      ...chrome,
      background: { service_worker: 'background.js', type: 'module' },
    });
    expect(manifest['background']).toEqual({ scripts: ['background.js'], type: 'module' });
  });

  it('copies every extension file into its own folder and leaves extension/ alone', async () => {
    const { buildFirefoxExtension } = await load();
    const to = join(mkdtempSync(join(tmpdir(), 'pangular-firefox-')), 'out');
    made.push(join(to, '..'));
    const manifest = buildFirefoxExtension({ from: extension, to });
    const written = JSON.parse(readFileSync(join(to, 'manifest.json'), 'utf8')) as Manifest;
    expect(written).toEqual(manifest);
    for (const file of [
      written['devtools_page'] as string,
      ...Object.values(written['icons'] as Record<string, string>),
      'panel.html',
      'panel-bridge.js',
    ]) {
      expect(existsSync(join(to, file)), file).toBe(true);
    }
    expect(JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'))).toEqual(chrome);
  });
});
