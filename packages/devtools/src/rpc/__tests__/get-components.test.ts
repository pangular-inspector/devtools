import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { describe, expect, it } from 'vitest';
import { getComponents } from '../get-components.ts';

async function componentsFor(source: string, angularVersion?: string) {
  const dir = fixtureDir('pangular-components-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'widgets.ts'), source);
  if (angularVersion) {
    const coreDir = join(dir, 'node_modules', '@angular', 'core');
    mkdirSync(coreDir, { recursive: true });
    writeFileSync(join(coreDir, 'package.json'), JSON.stringify({ version: angularVersion }));
  }
  return scan(getComponents, dir);
}

describe('get-components', () => {
  it('reports every component in a file with its own members', async () => {
    const components = await componentsFor(`
      @Component({ selector: 'app-alpha', template: '' })
      export class Alpha {
        count = input<number>(0)
        changed = output<string>()
      }

      @Component({ selector: 'app-beta', template: '', standalone: false })
      export class Beta {
        label = input.required<string>()
      }
    `);
    expect(components).toEqual([
      expect.objectContaining({
        selector: 'app-alpha',
        inputs: ['count'],
        outputs: ['changed'],
        isStandalone: true,
      }),
      expect.objectContaining({
        selector: 'app-beta',
        inputs: ['label'],
        outputs: [],
        isStandalone: false,
      }),
    ]);
  });

  it('defaults standalone from the Angular major of the project', async () => {
    const source = `
      @Component({ selector: 'app-plain', template: '' })
      export class Plain {}
      @Component({ selector: 'app-on', template: '', standalone: true })
      export class On {}
      @Component({ selector: 'app-off', template: '', providers: [{ standalone: true }], standalone: false })
      export class Off {}
      @Directive({ selector: '[appDir]' })
      export class Dir {}
    `;
    const flags = async (version?: string) =>
      (await componentsFor(source, version)).map((c) => c.isStandalone);
    expect(await flags('18.2.0')).toEqual([false, true, false, false]);
    expect(await flags('19.0.0')).toEqual([true, true, false, true]);
    expect(await flags()).toEqual([true, true, false, true]);
  });

  it('reads inputs declared without a type argument', async () => {
    const [component] = await componentsFor(`
      @Component({ selector: 'app-card', template: '' })
      export class Card {
        title = input('')
        size = input.required()
        expanded = model(false)
        closed = output()
      }
    `);
    expect(component.inputs).toEqual(['title', 'size', 'expanded']);
    expect(component.outputs).toEqual(['closed']);
  });

  it('marks a directive apart from a component', async () => {
    const found = await componentsFor(`
      @Component({ selector: 'app-card', template: '' })
      export class Card {}

      @Directive({ selector: '[appHighlight]' })
      export class Highlight {}
    `);
    expect(found.map((c) => [c.selector, c.kind])).toEqual([
      ['app-card', 'component'],
      ['[appHighlight]', 'directive'],
    ]);
  });

  it('ignores a component that is commented out', async () => {
    const components = await componentsFor(`
      // @Component({ selector: 'app-old', template: '' })
      // export class Old {}

      @Component({ selector: 'app-new', template: '' })
      export class New {}
    `);
    expect(components.map((c) => c.selector)).toEqual(['app-new']);
  });

  it('ignores declarations quoted inside a template', async () => {
    const [component] = await componentsFor(`
      @Component({
        selector: 'app-docs',
        template: \`<pre>title = input('quoted')</pre>\`,
      })
      export class Docs {
        real = input('')
      }
    `);
    expect(component.selector).toBe('app-docs');
    expect(component.inputs).toEqual(['real']);
  });

  it('still reads decorator based members', async () => {
    const [component] = await componentsFor(`
      @Component({ selector: 'app-legacy', template: '' })
      export class Legacy {
        @Input('aliased') name: string;
        @Output() saved = new EventEmitter<void>();
      }
    `);
    expect(component.inputs).toEqual(['name']);
    expect(component.outputs).toEqual(['saved']);
  });

  it('records components without a selector by class name, with kind and line', async () => {
    const found = await componentsFor(`
      import { Component, Directive } from '@angular/core';

      @Component({ template: '<p>routed</p>' })
      export class _TripPage {}

      @Directive()
      export abstract class Base {}

      class Helper {}
    `);
    expect(found).toEqual([
      expect.objectContaining({ selector: '', className: '_TripPage', kind: 'component', line: 5 }),
      expect.objectContaining({ selector: '', className: 'Base', kind: 'directive', line: 8 }),
    ]);
  });

  describe('change detection', () => {
    const strategyOf = async (decoratorBody: string, version = '22.0.0') =>
      (
        await componentsFor(
          `@Component({ selector: 'app-x', ${decoratorBody} })\nexport class X {}`,
          version,
        )
      )[0].changeDetection;

    it('reads qualified names and numeric values', async () => {
      expect(await strategyOf('changeDetection: ChangeDetectionStrategy.Eager')).toBe('Eager');
      expect(await strategyOf('changeDetection: core.ChangeDetectionStrategy.OnPush')).toBe(
        'OnPush',
      );
      expect(await strategyOf('changeDetection: ChangeDetectionStrategy.Default')).toBe('Eager');
      expect(await strategyOf('changeDetection: 0')).toBe('OnPush');
      expect(await strategyOf('changeDetection: 1')).toBe('Eager');
    });

    it('ignores a changeDetection key nested in another property', async () => {
      const nested = 'providers: [{ provide: X, useValue: { changeDetection: 1 } }]';
      expect(await strategyOf(nested)).toBe('OnPush');
      expect(await strategyOf(`${nested}, changeDetection: ChangeDetectionStrategy.OnPush`)).toBe(
        'OnPush',
      );
      expect(await strategyOf(`${nested}, changeDetection: ChangeDetectionStrategy.Eager`)).toBe(
        'Eager',
      );
    });

    it('reports unknown for expressions it cannot evaluate', async () => {
      expect(
        await strategyOf(
          'changeDetection: cond ? ChangeDetectionStrategy.OnPush : ChangeDetectionStrategy.Eager',
        ),
      ).toBe('unknown');
      expect(await strategyOf('changeDetection: pick(ChangeDetectionStrategy.OnPush)')).toBe(
        'unknown',
      );
    });
  });
});
