import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createUi } from '@devframes/hub-ui';
import { DEVFRAMES_HUB_BASE, initHub } from '@devframes/hub/initiate';
import type { InitHubOptions } from '@devframes/hub/initiate';
import ngDevtools from './devframe.ts';
import pkg from '../package.json' with { type: 'json' };

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 223 236"><path fill="#F5A524" d="m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z"/></svg>`;

export const NG_DEVTOOLS_HUB_BASE = DEVFRAMES_HUB_BASE;

export type NgDevtoolsHubOptions = Partial<Omit<InitHubOptions, 'devframes' | 'ui'>>;

function hubUiClientDir(): string | undefined {
  try {
    const own = createRequire(import.meta.url).resolve(`${pkg.name}/package.json`);
    const hubUi = createRequire(own).resolve('@devframes/hub-ui/package.json');
    const dir = join(dirname(hubUi), 'dist/client');
    return existsSync(join(dir, 'embedded.js')) ? dir : undefined;
  } catch {
    return undefined;
  }
}

function hubUi() {
  const ui = createUi({
    branding: {
      productName: 'Angular DevTools',
      logo: `data:image/svg+xml,${encodeURIComponent(LOGO)}`,
      primaryColor: '#f5a524',
    },
  });
  const dir = hubUiClientDir();
  if (!dir) return ui;
  return {
    ...ui,
    viewer: { distDir: join(dir, 'standalone') },
    embedded: { entry: join(dir, 'embedded.js') },
  };
}

export function initNgDevtoolsHub(options: NgDevtoolsHubOptions = {}) {
  return initHub({
    name: 'ng-devtools',
    version: pkg.version,
    base: NG_DEVTOOLS_HUB_BASE,
    ...options,
    devframes: [ngDevtools],
    ui: hubUi(),
  });
}
