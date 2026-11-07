import {readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import * as prettier from 'prettier';
import {API_DIR, readApiEntries, renderApiReference} from './api-reference';

const docsRoot = import.meta.dirname;
const repoRoot = resolve(docsRoot, '../..');
const dir = join(docsRoot, API_DIR);

describe('API reference', () => {
  it('matches the pages in the repository; run pnpm docs:api when it fails', async () => {
    const pages = renderApiReference(repoRoot, 'https://github.com/pangular-inspector/devtools');
    const onDisk = readdirSync(dir).filter((file) => file.endsWith('.md'));
    expect(onDisk.sort()).toEqual([...pages.keys()].sort());
    for (const [file, markdown] of pages) {
      const path = join(dir, file);
      const options = (await prettier.resolveConfig(path)) ?? {};
      const expected = await prettier.format(markdown, {...options, filepath: path});
      expect(readFileSync(path, 'utf8'), file).toBe(expected);
    }
  }, 60_000);

  it('documents the entry points apps use, without internal symbols', () => {
    const entries = readApiEntries(repoRoot);
    const hub = entries.find((entry) => entry.slug === 'hub');
    expect(hub?.symbols.map((s) => s.name)).toContain('initPangularHub');
    expect(entries.some((entry) => entry.slug === 'internal-config')).toBe(false);
  }, 60_000);

  it('shows inferred return types and symbols re-exported from a dependency', () => {
    const devframe = readApiEntries(repoRoot).find((entry) => entry.slug === 'devframe');
    const create = devframe?.symbols.find((s) => s.name === 'createPangular');
    expect(create?.declaration).toMatch(/\): import\(['"]devframe['"]\)\.DevframeDefinition$/);
    const init = devframe?.symbols.find((s) => s.name === 'initDevframe');
    expect(init).toMatchObject({kind: 'function', from: 'devframe', file: ''});
  }, 60_000);
});
