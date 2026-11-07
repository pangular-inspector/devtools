#!/usr/bin/env node
// Builds a Firefox copy of the extension into dist/extension-firefox. The
// files are the same as in extension/ (the committed Chrome build); only the
// manifest differs. Run it with `pnpm extension:build:firefox`, which builds
// extension/ui first.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The add-on ID Firefox keeps the extension under, and the oldest Firefox it installs on. */
export const GECKO_ID = 'pangular-inspector@pangular-inspector.dev';
export const GECKO_MIN_VERSION = '140.0';

/** Keys only Chrome reads: the ID-pinning `key` and the Chrome version floor. */
const CHROME_ONLY = ['key', 'minimum_chrome_version'];

/**
 * The Firefox manifest for a Chrome one: the Chrome-only keys removed, the
 * add-on ID and version floor under `browser_specific_settings.gecko`, and a
 * `background.service_worker` turned into `background.scripts`, which is
 * what Firefox runs. Everything else is kept as it is.
 */
export function firefoxManifest(chrome) {
  const manifest = structuredClone(chrome);
  for (const key of CHROME_ONLY) delete manifest[key];
  const background = manifest.background;
  if (background?.service_worker) {
    const { service_worker: worker, ...rest } = background;
    manifest.background = { ...rest, scripts: [worker] };
  }
  manifest.browser_specific_settings = {
    ...manifest.browser_specific_settings,
    gecko: {
      ...manifest.browser_specific_settings?.gecko,
      id: GECKO_ID,
      strict_min_version: GECKO_MIN_VERSION,
      // The extension sends nothing anywhere but the devtools server on the inspected page.
      data_collection_permissions: { required: ['none'] },
    },
  };
  return manifest;
}

/** Copies `from` to `to` (emptied first) and writes the Firefox manifest there. */
export function buildFirefoxExtension({ from, to }) {
  if (!existsSync(join(from, 'manifest.json'))) {
    throw new Error(`No manifest.json in ${from}`);
  }
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true, filter: (src) => !src.endsWith('.DS_Store') });
  const chrome = JSON.parse(readFileSync(join(from, 'manifest.json'), 'utf8'));
  const manifest = firefoxManifest(chrome);
  writeFileSync(join(to, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  const root = resolve(import.meta.dirname, '..');
  const to = join(root, 'dist/extension-firefox');
  buildFirefoxExtension({ from: join(root, 'extension'), to });
  console.log(`Wrote the Firefox extension to ${to}. Load it from about:debugging.`);
}
