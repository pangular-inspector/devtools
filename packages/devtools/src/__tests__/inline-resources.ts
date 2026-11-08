import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const RESOURCE = /\b(templateUrl|styleUrl)\s*:\s*(['"])([^'"]+)\2/g;

/**
 * The package tests render panel components in JIT, which cannot load `templateUrl` or
 * `styleUrl` on its own. This inlines them as `template` and `styles` for files under `appSrc`,
 * the same text the component would hold inline.
 */
export function inlineComponentResources(appSrc: string): Plugin {
  const root = resolve(appSrc) + sep;
  return {
    name: 'pangular-inline-component-resources',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.startsWith(root) || !file.endsWith('.ts')) return null;
      if (!code.includes('templateUrl') && !code.includes('styleUrl')) return null;
      const out = code.replace(RESOURCE, (_, key: string, _quote: string, path: string) => {
        const text = readFileSync(resolve(dirname(file), path), 'utf8');
        return `${key === 'templateUrl' ? 'template' : 'styles'}: ${JSON.stringify(text)}`;
      });
      return out === code ? null : { code: out, map: null };
    },
  };
}
