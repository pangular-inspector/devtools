import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { getComponents } from '../get-components.ts';

const component = (selector: string) => `@Component({ selector: '${selector}', template: '' })
export class X {}`;

describe('source scan feature folders', () => {
  it('reads feature folders named like generated output, and still skips real output', async () => {
    const dir = fixtureDir('pangular-feature-folders-');
    for (const folder of ['src/app/build', 'src/app/coverage', 'src/dist', 'src/node_modules/x']) {
      mkdirSync(join(dir, folder), { recursive: true });
      writeFileSync(
        join(dir, folder, 'x.component.ts'),
        component(`app-${folder.replace(/\W/g, '-')}`),
      );
    }
    const components = await scan(getComponents, dir);
    expect(components.map((c) => c.selector).sort()).toEqual([
      'app-src-app-build',
      'app-src-app-coverage',
    ]);
  });

  it('scans a project rooted in a feature folder only once', async () => {
    const dir = fixtureDir('pangular-nested-roots-');
    mkdirSync(join(dir, 'src/app/build'), { recursive: true });
    writeFileSync(join(dir, 'src/app/build/x.component.ts'), component('app-build'));
    writeFileSync(
      join(dir, 'angular.json'),
      JSON.stringify({
        projects: { web: { sourceRoot: 'src' }, tools: { sourceRoot: 'src/app/build' } },
      }),
    );
    const components = await scan(getComponents, dir);
    expect(components.map((c) => c.selector)).toEqual(['app-build']);
  });
});
