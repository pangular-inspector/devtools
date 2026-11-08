import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

const RESOURCE = /\b(templateUrl|styleUrl)\s*:\s*(['"])([^'"]+)\2/g;

// Vite ids use forward slashes, also on Windows, and the drive letter's case can differ.
const slashes = (path: string) => path.replaceAll('\\', '/');
const comparable = (path: string) =>
  process.platform === 'win32' ? slashes(path).toLowerCase() : slashes(path);

/**
 * The package tests render panel components in JIT, which cannot load `templateUrl` or
 * `styleUrl` on its own. This inlines them as `template` and `styles` for files under `appSrc`,
 * the same text the component would hold inline.
 */
export function inlineComponentResources(appSrc: string): Plugin {
  const root = comparable(resolve(appSrc)) + '/';
  return {
    name: 'pangular-inline-component-resources',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!comparable(file).startsWith(root) || !file.endsWith('.ts')) return null;
      if (!code.includes('templateUrl') && !code.includes('styleUrl')) return null;
      const out = code.replace(RESOURCE, (_, key: string, _quote: string, path: string) => {
        const text = readFileSync(resolve(dirname(file), path), 'utf8');
        return `${key === 'templateUrl' ? 'template' : 'styles'}: ${JSON.stringify(text)}`;
      });
      return out === code ? null : { code: out, map: null };
    },
  };
}
