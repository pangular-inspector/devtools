import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalogBuild } from '../pages/analog-build';
import { AnalogContentPreview } from '../pages/analog-content-preview';
import { AnalogData, loadRouteOf, payloadRows } from '../pages/analog-data';
import { inline, markdownBlocks } from '../pages/analog-markdown';
import { AnalogRuntime } from '../pages/analog-runtime';
import { AnalogTransform } from '../pages/analog-transform';

type Answers = Record<string, (arg?: unknown) => unknown>;

function client(answers: Answers, shared: Record<string, unknown> = {}) {
  const calls: [string, unknown][] = [];
  const rpc = {
    call: (name: string, arg?: unknown) => {
      calls.push([name, arg]);
      return Promise.resolve(answers[name]?.(arg) ?? null);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => shared[name] ?? null, on: () => () => {} }),
  };
  const rpcClient = {
    connectionMeta: {},
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient;
  return { rpcClient, calls };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('markdown preview reader', () => {
  it('turns markdown into blocks without HTML', () => {
    const blocks = markdownBlocks(
      '# Title\n\nSome **bold** and `code` with a [link](https://x.dev) <b>tag</b>.\n\n- a\n- b\n\n```ts\nconst x = 1;\n```\n\n> quoted\n\n---\n',
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'list',
      'code',
      'quote',
      'rule',
    ]);
    expect(inline('Some **bold** and `code` [link](u) <b>tag</b>')).toEqual([
      { text: 'Some ' },
      { text: 'bold', strong: true },
      { text: ' and ' },
      { text: 'code', code: true },
      { text: ' link tag' },
    ]);
  });
});

describe('Analog content preview', () => {
  it('shows schema problems, frontmatter and the rendered body', async () => {
    const { rpcClient } = client({
      'analog-content-preview': () => ({
        file: '/src/content/a.md',
        values: { title: 'A', tags: ['x'] },
        body: '# Hello\n\n<script>alert(1)</script>Text',
        schemaErrors: ['date is required.'],
      }),
    });
    const fixture = TestBed.createComponent(AnalogContentPreview);
    fixture.componentRef.setInput('rpc', rpcClient);
    fixture.componentRef.setInput('file', '/src/content/a.md');
    fixture.componentRef.setInput('schema', '/content.schema.json');
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('date is required.');
    expect(host.textContent).toContain('["x"]');
    expect(host.querySelector('.md-heading')?.textContent?.trim()).toBe('Hello');
    expect(host.querySelector('script')).toBeNull();
  });
});

describe('Analog transform stack', () => {
  it('lists the plugins that changed the file and whether server function ids made it', async () => {
    const { rpcClient, calls } = client({
      'analog-transform': () => ({
        file: '/src/app/pages/a.page.ts',
        ssr: false,
        steps: [
          { plugin: 'analog', changed: true, ms: 2, size: 40, code: 'compiled' },
          { plugin: 'noop', changed: false, ms: 0, size: 40 },
        ],
        code: 'serverFn("abc")',
      }),
    });
    const fixture = TestBed.createComponent(AnalogTransform);
    fixture.componentRef.setInput('rpc', rpcClient);
    fixture.componentRef.setInput('file', '/src/app/pages/a.page.ts');
    fixture.componentRef.setInput('serverFns', [
      { name: 'getX', id: 'abc', file: '/src/app/pages/a.page.ts' },
    ]);
    await settle(fixture);
    const t = fixture.componentInstance;
    expect(t.changed().map((s) => s.plugin)).toEqual(['analog']);
    expect(t.unchanged()).toBe(1);
    expect(t.ids()).toEqual([expect.objectContaining({ name: 'getX', found: true })]);
    t.ssr.set(true);
    await settle(fixture);
    expect(calls.at(-1)).toEqual([
      'analog-transform',
      { file: '/src/app/pages/a.page.ts', ssr: true },
    ]);
  });
});

describe('Analog build analysis', () => {
  it('says to build first, then shows page chunks', async () => {
    let found = false;
    const { rpcClient } = client({
      'analog-build': () =>
        found
          ? {
              found: true,
              dir: 'dist/analog/public',
              manifest: false,
              totals: { js: 2048, css: 10, jsGzip: 900, cssGzip: 9, chunks: 3 },
              chunks: [],
              routes: [
                {
                  path: '/a',
                  file: '/a.page.ts',
                  chunk: 'assets/a.js',
                  size: 100,
                  gzip: 50,
                  shared: [],
                  lazy: ['assets/m.js'],
                },
              ],
              notes: [],
            }
          : { found: false, manifest: false, totals: {}, chunks: [], routes: [], notes: [] },
    });
    const fixture = TestBed.createComponent(AnalogBuild);
    fixture.componentRef.setInput('rpc', rpcClient);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No client build yet');
    found = true;
    fixture.componentInstance.reload();
    await settle(fixture);
    expect(host.textContent).toContain('assets/a.js');
    expect(host.textContent).toContain('assets/m.js');
  });
});

describe('Analog runtime view', () => {
  it('purges a cache entry only after Delete is clicked', async () => {
    const entries = [
      {
        file: '/.nitro/cache/nitro/routes/a.json',
        group: 'routes',
        key: 'a',
        size: 10,
        modifiedAt: 1,
      },
      {
        file: '/.nitro/cache/nitro/routes/b.json',
        group: 'routes',
        key: 'b',
        size: 10,
        modifiedAt: 1,
      },
    ];
    const { rpcClient, calls } = client({
      'analog-runtime-config': () => ({
        env: [{ key: 'VITE_X', value: '[redacted]', from: '.env', masked: true }],
        runtimeConfig: [],
        options: [{ key: 'ssr', value: 'true', from: 'default' }],
      }),
      'analog-nitro': () => ({
        plugins: [],
        tasks: [],
        storage: [],
        cachedRules: [],
        cacheDirs: ['.nitro/cache'],
        entries,
        notes: [],
      }),
      'analog-nitro-purge': () => ({ ok: true, removed: 1 }),
    });
    const fixture = TestBed.createComponent(AnalogRuntime);
    fixture.componentRef.setInput('rpc', rpcClient);
    await settle(fixture);
    const runtime = fixture.componentInstance;
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('masked');
    runtime.ask([entries[0].file]);
    expect(calls.some(([name]) => name === 'analog-nitro-purge')).toBe(false);
    await runtime.purge(runtime.confirming()!);
    expect(calls.find(([name]) => name === 'analog-nitro-purge')?.[1]).toEqual({
      files: [entries[0].file],
      confirm: true,
    });
    expect(runtime.message()).toBe('Deleted 1 cache entry.');
    runtime.ask(null);
    await runtime.purge(runtime.confirming()!);
    expect(calls.filter(([name]) => name === 'analog-nitro-purge').at(-1)?.[1]).toEqual({
      files: undefined,
      confirm: true,
    });
  });
});

describe('Analog data view', () => {
  it('labels payload entries and loads the full load() value on demand', async () => {
    const { rpcClient, calls } = client(
      { 'analog-load-data': () => ({ found: true, value: { product: { id: 7 } } }) },
      {
        'http-payloads': {
          pages: {
            p1: {
              found: true,
              size: 30,
              entries: [
                {
                  key: 'analog_1',
                  source: 'analog',
                  http: { url: '/_analog/pages/products/(shop)/index' },
                  size: 10,
                },
                { key: '__analog_fn_abc_', source: 'analog', fn: { id: 'abc' }, size: 10 },
                { key: 'cfg', size: 10 },
              ],
            },
          },
        },
      },
    );
    const fixture = TestBed.createComponent(AnalogData);
    fixture.componentRef.setInput('rpc', rpcClient);
    fixture.componentRef.setInput('page', {
      pageId: 'p1',
      url: '/products',
      load: { preview: '{"product":{}}', bytes: 20, keys: ['product'] },
    });
    fixture.componentRef.setInput('serverFns', [
      { id: 'abc', name: 'getCart', file: '/c.server.ts' },
    ]);
    fixture.componentRef.setInput('duplicates', [{ route: '/products' }]);
    await settle(fixture);
    const data = fixture.componentInstance;
    expect(data.rows().map((r) => [r.kind, r.label, r.reuse])).toEqual([
      ['load', 'load() of /products', 'refetched'],
      ['fn', 'getCart()', 'reused'],
      ['state', 'App state', undefined],
    ]);
    await data.loadFull();
    await settle(fixture);
    expect(calls.find(([name]) => name === 'analog-load-data')?.[1]).toBe('p1');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-analog-value-node'),
    ).not.toBeNull();
  });

  it('maps load endpoints back to routes', () => {
    expect(loadRouteOf('http://localhost:5173/api/_analog/pages/blog/-slug-')).toBe('/blog');
    expect(loadRouteOf('/x')).toBeUndefined();
    expect(payloadRows([{ key: 'h', source: 'hydration', size: 1 }], [], [], [])[0].kind).toBe(
      'hydration',
    );
  });
});

describe('Analog Nitro tasks', () => {
  it('runs a task only after Run task is clicked, with its payload', async () => {
    const { rpcClient, calls } = client({
      'analog-runtime-config': () => ({ env: [], runtimeConfig: [], options: [] }),
      'analog-nitro': () => ({
        plugins: [],
        tasks: [{ name: 'db:migrate', file: '/src/server/tasks/db/migrate.ts' }],
        storage: [],
        cachedRules: [],
        cacheDirs: [],
        entries: [],
        notes: [],
      }),
      'analog-run-nitro-task': () => ({
        ok: true,
        name: 'db:migrate',
        status: 200,
        ms: 12,
        output: '{"result":"[redacted]"}',
      }),
    });
    const fixture = TestBed.createComponent(AnalogRuntime);
    fixture.componentRef.setInput('rpc', rpcClient);
    await settle(fixture);
    const runtime = fixture.componentInstance;
    runtime.askTask('db:migrate');
    await settle(fixture);
    expect(calls.some(([name]) => name === 'analog-run-nitro-task')).toBe(false);
    runtime.taskPayload.set('{bad');
    await runtime.runTask('db:migrate');
    expect(runtime.taskResults()['db:migrate'].error).toMatch(/not valid JSON/);
    runtime.taskPayload.set('{"dry":true}');
    await runtime.runTask('db:migrate');
    await settle(fixture);
    expect(calls.find(([name]) => name === 'analog-run-nitro-task')?.[1]).toEqual({
      name: 'db:migrate',
      payload: { dry: true },
      confirm: true,
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('[redacted]');
  });

  it('keeps the confirm panel and payload open when a run fails, and closes it after a run that works', async () => {
    let ok = false;
    const { rpcClient } = client({
      'analog-runtime-config': () => ({ env: [], runtimeConfig: [], options: [] }),
      'analog-nitro': () => ({
        plugins: [],
        tasks: [{ name: 'db:migrate', file: '/src/server/tasks/db/migrate.ts' }],
        storage: [],
        cachedRules: [],
        cacheDirs: [],
        entries: [],
        notes: [],
      }),
      'analog-run-nitro-task': () =>
        ok
          ? { ok: true, name: 'db:migrate', status: 200, ms: 1, output: '' }
          : { ok: false, name: 'db:migrate', error: 'Task failed.' },
    });
    const fixture = TestBed.createComponent(AnalogRuntime);
    fixture.componentRef.setInput('rpc', rpcClient);
    await settle(fixture);
    const runtime = fixture.componentInstance;
    runtime.askTask('db:migrate');
    runtime.taskPayload.set('{"dry":true}');
    await runtime.runTask('db:migrate');
    expect(runtime.taskConfirm()).toBe('db:migrate');
    expect(runtime.taskPayload()).toBe('{"dry":true}');
    ok = true;
    await runtime.runTask('db:migrate');
    expect(runtime.taskConfirm()).toBeNull();
  });

  it('starts a task once, even when Run task is used again while it runs', async () => {
    let answer!: (value: unknown) => void;
    const { rpcClient, calls } = client({
      'analog-runtime-config': () => ({ env: [], runtimeConfig: [], options: [] }),
      'analog-nitro': () => ({
        plugins: [],
        tasks: [{ name: 'db:migrate', file: '/src/server/tasks/db/migrate.ts' }],
        storage: [],
        cachedRules: [],
        cacheDirs: [],
        entries: [],
        notes: [],
      }),
      'analog-run-nitro-task': () => new Promise((resolve) => (answer = resolve)),
    });
    const fixture = TestBed.createComponent(AnalogRuntime);
    fixture.componentRef.setInput('rpc', rpcClient);
    await settle(fixture);
    const runtime = fixture.componentInstance;
    runtime.askTask('db:migrate');
    const first = runtime.runTask('db:migrate');
    runtime.askTask('db:migrate');
    await runtime.runTask('db:migrate');
    expect(calls.filter(([name]) => name === 'analog-run-nitro-task')).toHaveLength(1);
    answer({ ok: true, name: 'db:migrate', status: 200, ms: 1, output: '' });
    await first;
    expect(runtime.runningTask()).toBeNull();
  });
});

describe('markdown code spans', () => {
  it('keeps HTML and links inside code spans as written', () => {
    expect(inline('Use `<b>[a](b)</b>` here')).toEqual([
      { text: 'Use ' },
      { text: '<b>[a](b)</b>', code: true },
      { text: ' here' },
    ]);
  });
});
