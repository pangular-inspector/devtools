import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { getComponents } from '../get-components.ts';

async function componentsFor(source: string) {
  const dir = fixtureDir('pangular-components-decorators-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'widgets.ts'), source);
  return scan(getComponents, dir);
}

describe('get-components decorator members', () => {
  it('keeps inputs and outputs whose options contain a closing parenthesis', async () => {
    const [component] = await componentsFor(`
      @Component({ selector: 'a', template: '' })
      export class A {
        @Input({ transform: (v: string) => v.trim() }) name = '';
        @Input() other = '';
        @Output() changed = new EventEmitter();
        @Output(alias()) renamed = new EventEmitter();
      }
    `);
    expect(component.inputs).toEqual(['name', 'other']);
    expect(component.outputs).toEqual(['changed', 'renamed']);
  });
});
