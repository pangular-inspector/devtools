import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { describe, expect, it } from 'vitest';
import { getSignals } from '../get-signals.ts';

async function signalsFor(source: string) {
  const dir = fixtureDir('pangular-signals-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.ts'), source);
  return scan(getSignals, dir);
}

describe('get-signals', () => {
  it('reads the kind of each declaration', async () => {
    const signals = await signalsFor(`
      class Counter {
        count = signal(0)
        double = computed(() => this.count() * 2)
        label = linkedSignal(() => '')
        log = effect(() => {})
        data = resource({ loader: () => Promise.resolve(1) })
      }
    `);
    expect(signals.map((s) => [s.name, s.kind])).toEqual([
      ['count', 'signal'],
      ['double', 'computed'],
      ['label', 'linkedSignal'],
      ['log', 'effect'],
      ['data', 'resource'],
    ]);
  });

  it('reports a required input once', async () => {
    const signals = await signalsFor(`
      class Profile {
        name = input.required<string>()
        nickname = input('')
      }
    `);
    expect(signals.map((s) => [s.name, s.kind])).toEqual([
      ['name', 'input.required (signal)'],
      ['nickname', 'input (signal)'],
    ]);
  });

  it('reports a required query once', async () => {
    const signals = await signalsFor(`
      class Panel {
        body = viewChild.required<ElementRef>('body')
        rows = contentChildren(Row)
      }
    `);
    expect(signals.map((s) => [s.name, s.kind])).toEqual([
      ['body', 'viewChild.required (signal)'],
      ['rows', 'contentChildren (signal)'],
    ]);
  });

  it('attributes each signal to the class that declares it', async () => {
    const signals = await signalsFor(`
      @Component({ selector: 'app-first' })
      export class First {
        a = signal(0)
      }

      @Component({ selector: 'app-second' })
      export class Second {
        b = signal(0)
      }
    `);
    expect(signals.map((s) => [s.name, s.component])).toEqual([
      ['a', 'app-first'],
      ['b', 'app-second'],
    ]);
  });

  it('reads the selector of a directive', async () => {
    const signals = await signalsFor(`
      @Directive({ selector: '[appHighlight]' })
      export class Highlight {
        color = input('red')
      }
    `);
    expect(signals[0].component).toBe('[appHighlight]');
  });

  it('reports no component for an undecorated class', async () => {
    const signals = await signalsFor(`
      @Component({ selector: 'app-first' })
      export class First {
        a = signal(0)
      }

      export class Store {
        b = signal(0)
      }
    `);
    expect(signals.map((s) => [s.name, s.component])).toEqual([
      ['a', 'app-first'],
      ['b', undefined],
    ]);
  });

  it('reads names that are not plain identifiers', async () => {
    const signals = await signalsFor(`
      class Counter {
        count$ = signal(0)
        #hidden = signal(0)
        readonly total: WritableSignal<number> = signal(0)
      }
    `);
    expect(signals.map((s) => s.name)).toEqual(['count$', '#hidden', 'total']);
  });

  it('does not open a class scope inside a template', async () => {
    const signals = await signalsFor(
      '@Component({\n' +
        "  selector: 'app-docs',\n" +
        '  template: `<pre>class Example {</pre>`,\n' +
        '})\n' +
        'export class Docs {\n' +
        '  shown = signal(true)\n' +
        '}\n' +
        '\n' +
        '@Component({\n' +
        "  selector: 'app-next',\n" +
        '})\n' +
        'export class Next {\n' +
        '  open = signal(false)\n' +
        '}\n',
    );
    expect(signals.map((s) => [s.name, s.component])).toEqual([
      ['shown', 'app-docs'],
      ['open', 'app-next'],
    ]);
  });

  it('reads a declaration assigned through this, but not other members', async () => {
    const signals = await signalsFor(`
      class Counter {
        constructor() {
          this.total = signal(0)
          this.store.count = signal(0)
        }
      }
    `);
    expect(signals.map((s) => s.name)).toEqual(['total']);
  });

  it('finds the class body past a generic constraint', async () => {
    const signals = await signalsFor(`
      @Component({ selector: 'app-panel' })
      export class Panel<T extends { id: string }> {
        value = signal(0)
      }
    `);
    expect(signals.map((s) => [s.name, s.component])).toEqual([['value', 'app-panel']]);
  });

  it('ignores a decorator written inside a template', async () => {
    const signals = await signalsFor(
      '@Component({\n' +
        "  selector: 'app-docs',\n" +
        "  template: `<pre>@Component({ selector: 'fake' })</pre>`,\n" +
        '})\n' +
        'export class Docs {\n' +
        '  shown = signal(true)\n' +
        '}\n',
    );
    expect(signals.map((s) => [s.name, s.component])).toEqual([['shown', 'app-docs']]);
  });

  it('reads a selector past whitespace before the arguments', async () => {
    const signals = await signalsFor(`
      @Component
      ({ selector: 'app-panel' })
      export class Panel {
        value = signal(0)
      }
    `);
    expect(signals.map((s) => [s.name, s.component])).toEqual([['value', 'app-panel']]);
  });

  it('ignores a selector key written inside a template', async () => {
    const signals = await signalsFor(
      '@Component({\n' +
        "  template: `<pre>selector: 'fake'</pre>`,\n" +
        "  selector: 'app-real',\n" +
        '})\n' +
        'export class Docs {\n' +
        '  shown = signal(true)\n' +
        '}\n',
    );
    expect(signals.map((s) => [s.name, s.component])).toEqual([['shown', 'app-real']]);
  });

  it('reads the selector key exactly, whatever the spacing', async () => {
    const signals = await signalsFor(`
      @Component({
        myselector: 'nope',
        selector : 'app-real',
      })
      export class Panel {
        value = signal(0)
      }
    `);
    expect(signals.map((s) => [s.name, s.component])).toEqual([['value', 'app-real']]);
  });

  it('ignores declarations in comments', async () => {
    const signals = await signalsFor(`
      class Counter {
        // count = signal(0)
        /* stale = computed(() => 0) */
        total = signal(0)
      }
    `);
    expect(signals.map((s) => s.name)).toEqual(['total']);
  });

  it('ignores declarations quoted in a template', async () => {
    const signals = await signalsFor(
      '@Component({\n' +
        "  selector: 'app-docs',\n" +
        '  template: `<code>count = signal(0)</code>`,\n' +
        '})\n' +
        'export class Docs {\n' +
        '  shown = signal(true)\n' +
        '}\n',
    );
    expect(signals.map((s) => s.name)).toEqual(['shown']);
  });

  it('reports the line a declaration is on, past a block comment', async () => {
    const signals = await signalsFor(
      ['/**', ' * Counts things.', ' */', 'class Counter {', '  total = signal(0)', '}'].join('\n'),
    );
    expect(signals.map((s) => [s.name, s.line])).toEqual([['total', 5]]);
  });

  it('reports the file each declaration comes from', async () => {
    const signals = await signalsFor(`class Counter { total = signal(0) }`);
    expect(signals[0].file).toBe('src/app.ts');
  });

  it('skips outputs and reads toSignal and the resource helpers', async () => {
    const signals = await signalsFor(`
      class Search {
        picked = output<string>()
        query = toSignal(this.route.queryParams)
        results = httpResource(() => '/api?q=' + this.query())
        text = httpResource.text(() => '/readme')
        stream = rxResource({ stream: () => of(1) })
      }
    `);
    expect(signals.map((s) => [s.name, s.kind])).toEqual([
      ['query', 'toSignal'],
      ['results', 'httpResource'],
      ['text', 'httpResource'],
      ['stream', 'rxResource'],
    ]);
  });
});
