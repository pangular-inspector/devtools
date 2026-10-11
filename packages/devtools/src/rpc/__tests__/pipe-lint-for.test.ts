import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureDir } from './fixture-dir.ts';
import { lintPipes } from '../pipe-lint.ts';

function lintFor(template: string) {
  const dir = fixtureDir('pangular-pipe-lint-for-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(
    join(dir, 'src', 'app.ts'),
    [
      `@Pipe({ name: 'slow', pure: false })`,
      `export class SlowPipe {}`,
      `@Component({ selector: 'a', template: \`${template}\` })`,
      `export class A {}`,
    ].join('\n'),
  );
  return lintPipes(dir).filter((f) => f.rule === 'impure-pipe-in-for');
}

describe('impure-pipe-in-for block matching', () => {
  it('does not flag a pipe after a compact loop', () => {
    const template = `<ul>@for (i of items; track i) {<li>{{ i }}</li>}</ul><p>{{ title | slow }}</p>`;
    expect(lintFor(template)).toEqual([]);
  });

  it('ignores a brace inside a string when finding the end of the loop body', () => {
    const template = `@for (x of xs; track x) { {{ '}' }} {{ x | slow }} }`;
    expect(lintFor(template)).toHaveLength(1);
  });

  it('reports a pipe in nested loops once', () => {
    const template = `@for (r of rows; track r) {\n@for (c of r; track c) {\n{{ c | slow }}\n}\n}`;
    expect(lintFor(template)).toHaveLength(1);
  });
});
