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

  it('does not flag async or json inside a loop', () => {
    const template = `@for (item of items; track item) { {{ item.price$ | async }} {{ item | json }} }`;
    expect(lintFor(template)).toEqual([]);
  });

  it('still flags other impure built-ins inside a loop', () => {
    const template = `@for (item of items; track item) { {{ item.map | keyvalue }} }`;
    expect(lintFor(template).map((f) => f.pipe)).toEqual(['keyvalue']);
  });

  it('flags an impure pipe inside an *ngFor element', () => {
    const template = `<ul><li *ngFor="let i of items" [title]="i | slow"><b>{{ i | slow }}</b></li></ul>`;
    const findings = lintFor(template);
    expect(findings).toHaveLength(2);
    expect(findings[0].message).toContain('*ngFor');
  });

  it('stops an *ngFor element at its matching end tag', () => {
    const template = `<div *ngFor="let i of items"><div>{{ i }}</div></div><p>{{ title | slow }}</p>`;
    expect(lintFor(template)).toEqual([]);
  });

  it('handles a self-closing *ngFor element', () => {
    const template = `<app-row *ngFor="let r of rows" [label]="r | slow" /><p>{{ title | slow }}</p>`;
    expect(lintFor(template)).toHaveLength(1);
  });

  it('finds an *ngFor element whose earlier attributes contain a bare <', () => {
    const hidden = `<ul><li [hidden]="n < 2" *ngFor="let x of xs">{{ x | slow }}</li></ul>`;
    expect(lintFor(hidden)).toHaveLength(1);
    const compare = `<li [x]="a<b" *ngFor="let x of xs">{{ x }}</li><p>{{ title | slow }}</p>`;
    expect(lintFor(compare)).toEqual([]);
  });

  it('does not end an *ngFor element at an end tag inside an attribute value', () => {
    const template = `<li *ngFor="let x of xs"><span title="</li>">{{ x | slow }}</span></li>`;
    expect(lintFor(template)).toHaveLength(1);
  });

  it('does not take *ngFor inside an attribute value for the directive', () => {
    const template = `<p title="use *ngFor = here">{{ title | slow }}</p>`;
    expect(lintFor(template)).toEqual([]);
  });
});
