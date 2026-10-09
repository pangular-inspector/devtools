import { describe, expect, it } from 'vitest';
import { pipeUsesIn } from '../get-pipes.ts';

describe('pipeUsesIn expression edge cases', () => {
  it('ignores pipe-looking text inside a string literal', () => {
    expect(pipeUsesIn(`<p>{{ 'x | json' }}</p>`)).toEqual([]);
    expect(pipeUsesIn(`<p [title]="'a | date'"></p>`)).toEqual([]);
  });

  it('still reports a real pipe next to a string', () => {
    expect(pipeUsesIn(`<p>{{ 'x' + v | json }}</p>`).map((u) => u.name)).toEqual(['json']);
  });

  it('reads pipes in animation and prefixed bindings', () => {
    expect(pipeUsesIn(`<div [@fade]="s | async"></div>`).map((u) => u.name)).toEqual(['async']);
    expect(pipeUsesIn(`<div (@fade.done)="x(e | json)"></div>`).map((u) => u.name)).toEqual([
      'json',
    ]);
    expect(pipeUsesIn(`<div bind-title="s | async"></div>`).map((u) => u.name)).toEqual(['async']);
  });
});
