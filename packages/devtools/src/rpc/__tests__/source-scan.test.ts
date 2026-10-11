import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { describe, expect, it } from 'vitest';
import { getComponents } from '../get-components.ts';
import { getNgrxStore } from '../get-ngrx-store.ts';
import { getProviders } from '../get-providers.ts';
import { getRoutes } from '../get-routes.ts';
import { getSignals } from '../get-signals.ts';
import {
  lineCounter,
  maskStrings,
  matchDelimiter,
  sourceRoots,
  startsRegex,
  stripComments,
} from '../source-scan.ts';

function workspace(files: Record<string, string>, workspaceJson?: unknown) {
  const dir = fixtureDir('pangular-scan-');
  if (workspaceJson) writeFileSync(join(dir, 'angular.json'), JSON.stringify(workspaceJson));
  for (const [path, contents] of Object.entries(files)) {
    const at = join(dir, path);
    mkdirSync(join(at, '..'), { recursive: true });
    writeFileSync(at, contents);
  }
  return dir;
}

describe('lexing', () => {
  it('does not treat a quote inside a regular expression as a string', () => {
    const source = 'const re = /[\'"]/;\nconst after = 1;\n';
    expect(maskStrings(source)).toBe(source);
    expect(stripComments(source)).toBe(source);
  });

  it('keeps scanning past a regular expression that contains a quote', async () => {
    const dir = workspace({
      'src/a.ts': [
        "@Component({ selector: 'app-first', template: '' })",
        'export class First {}',
        "const slug = (s: string) => s.replace(/['\"]/g, '');",
        "@Component({ selector: 'app-second', template: '' })",
        'export class Second { count = signal(0); }',
      ].join('\n'),
    });

    const components = await scan(getComponents, dir);
    expect(components.map((c) => c.selector)).toEqual(['app-first', 'app-second']);

    const signals = await scan(getSignals, dir);
    expect(signals.map((s) => s.name)).toEqual(['count']);
  });

  it('keeps reading routes after a regular expression', async () => {
    const dir = workspace({
      'src/app.routes.ts': [
        "const isId = /^[a-z']+$/;",
        'export const routes = [{ path: 1, component: Home }];'.replace('1', "'home'"),
      ].join('\n'),
    });
    const routes = await scan(getRoutes, dir);
    expect(routes.map((r) => r.path)).toEqual(['home']);
  });

  it('reports the line of a match without rescanning the file', () => {
    const at = lineCounter('a\nb\nc');
    expect([at(0), at(2), at(4)]).toEqual([1, 2, 3]);
  });
});

describe('source roots', () => {
  it('ignores a root that points outside the workspace', () => {
    const dir = workspace({ 'src/a.ts': '' }, { projects: { escape: { sourceRoot: '../..' } } });
    expect(sourceRoots(dir)).toEqual([join(dir, 'src')]);
  });

  it('ignores a root that points at a generated directory', () => {
    const dir = workspace(
      { 'src/a.ts': '', 'node_modules/pkg/a.ts': '' },
      { projects: { bad: { sourceRoot: 'node_modules' } } },
    );
    expect(sourceRoots(dir)).toEqual([join(dir, 'src')]);
  });

  it('drops a root nested inside another so nothing is reported twice', async () => {
    const dir = workspace(
      {
        'src/lib/src/widget.ts':
          "@Component({ selector: 'lib-x', template: '' }) export class X {}",
      },
      { projects: { app: { sourceRoot: 'src' }, lib: { sourceRoot: 'src/lib/src' } } },
    );
    expect(sourceRoots(dir)).toEqual([join(dir, 'src')]);
    const components = await scan(getComponents, dir);
    expect(components.map((c) => c.selector)).toEqual(['lib-x']);
  });

  it('scans nothing rather than the whole directory when no source root exists', () => {
    const dir = workspace({ 'lib/a.ts': '' });
    expect(sourceRoots(dir)).toEqual([]);
  });
});

describe('component metadata', () => {
  it('reads standalone from the component own decorator', async () => {
    const dir = workspace({
      'src/a.ts': [
        'const legacyMeta = { standalone: false };',
        "@Component({ selector: 'app-modern', template: '' })",
        'export class Modern {}',
        "@Component({ selector: 'app-legacy', template: '', standalone: false })",
        'export class Legacy {}',
      ].join('\n'),
    });
    const components = await scan(getComponents, dir);
    expect(components.map((c) => [c.selector, c.isStandalone])).toEqual([
      ['app-modern', true],
      ['app-legacy', false],
    ]);
  });
});

describe('matchDelimiter', () => {
  it('does not count brackets inside a regex literal', () => {
    const code = 'providers: [{ provide: T, useValue: /\\[/ }, Real]\nconst after = [Alpha];';
    const open = code.indexOf('[');
    expect(code.slice(open, matchDelimiter(code, open, '[', ']') + 1)).toBe(
      '[{ provide: T, useValue: /\\[/ }, Real]',
    );
  });

  it('stays linear when every component holds an unbalanced regex', async () => {
    const files = Array.from(
      { length: 400 },
      (_, i) =>
        `@Component({ selector: 'c${i}', providers: [{ provide: T${i}, useValue: /\\[/ }, Real${i}] })\nexport class C${i} {}`,
    ).join('\n');
    const dir = workspace({ 'src/a.ts': files });
    const providers = await scan(getProviders, dir);
    expect(providers).toHaveLength(800);
  });
});

describe('review regressions', () => {
  it('prunes a nested root even when a sibling sorts between them', () => {
    const dir = fixtureDir('pangular-nest-');
    for (const d of ['src', 'src-electron', 'src/lib'])
      mkdirSync(join(dir, d), { recursive: true });
    writeFileSync(
      join(dir, 'angular.json'),
      JSON.stringify({
        projects: {
          a: { sourceRoot: 'src' },
          b: { sourceRoot: 'src-electron' },
          c: { sourceRoot: 'src/lib' },
        },
      }),
    );
    expect(
      sourceRoots(dir)
        .map((r) => relative(dir, r))
        .sort(),
    ).toEqual(['src', 'src-electron']);
  });

  it('reads a workspace file with comments and a trailing comma', async () => {
    const dir = fixtureDir('pangular-jsonc-');
    mkdirSync(join(dir, 'apps', 'shop', 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'angular.json'),
      '{\n  // the shop\n  "projects": { "shop": { "sourceRoot": "apps/shop/src" } },\n}',
    );
    writeFileSync(
      join(dir, 'apps', 'shop', 'src', 'a.ts'),
      "@Component({ selector: 'app-shop', template: '' }) class S {}",
    );
    const found = await scan(getComponents, dir);
    expect(found.map((c) => c.selector)).toEqual(['app-shop']);
  });

  it('names a decorated accessor after the member, not the keyword', async () => {
    const dir = workspace({
      'src/a.ts': [
        "@Component({ selector: 'app-legacy', template: '' })",
        'export class Legacy {',
        '  @Input() set value(v: string) {}',
        '  @Input() private label: string;',
        '  @Output() override changed = new EventEmitter();',
        '}',
      ].join('\n'),
    });
    const [component] = await scan(getComponents, dir);
    expect(component.inputs).toEqual(['value', 'label']);
    expect(component.outputs).toEqual(['changed']);
  });

  it('finds a signal whose annotation holds a function type', async () => {
    const dir = workspace({
      'src/a.ts': 'class S { callback: WritableSignal<() => void> = signal(() => {}); }',
    });
    const found = await scan(getSignals, dir);
    expect(found.map((s) => s.name)).toContain('callback');
  });

  it('does not report a store spelled out inside a regex literal', async () => {
    const dir = workspace({
      'src/a.ts':
        'const pattern = /export const FakeStore = signalStore()/;\nexport const Real = signalStore(withState({}));',
    });
    const found = await scan(getNgrxStore, dir);
    expect(found.map((e) => e.name)).toEqual(['Real']);
  });
});

describe('second review pass', () => {
  it('treats `.of` as a property, so the division is not a regex', async () => {
    const dir = workspace({
      'src/a.ts': [
        "const x = object.of / 2 /* @Component({ selector: 'app-fake', template: '' }) class Fake {} */ / 3;",
        "@Component({ selector: 'app-real', template: '' })",
        'export class Real {}',
      ].join('\n'),
    });
    const found = await scan(getComponents, dir);
    expect(found.map((c) => c.selector)).toEqual(['app-real']);
  });

  it('still opens a regex after a keyword', () => {
    expect(startsRegex('return /re/', 7)).toBe(true);
    expect(startsRegex('typeof x / 2', 9)).toBe(false);
  });

  it('keeps a trailing comma sequence that sits inside a path', () => {
    const dir = fixtureDir('pangular-jsonc2-');
    mkdirSync(join(dir, 'apps', 'x,}', 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'angular.json'),
      '{\n  // c\n  "projects": { "a": { "sourceRoot": "apps/x,}/src" }, },\n}',
    );
    expect(sourceRoots(dir).map((r) => relative(dir, r))).toEqual([join('apps', 'x,}', 'src')]);
  });
});

describe('third review pass', () => {
  it('does not read a decorator with a longer name as @Component', async () => {
    const dir = workspace({
      'src/a.ts': [
        "@Component({ selector: 'app-x', template: '', standalone: false })",
        '@ComponentMeta()',
        'export class X {}',
      ].join('\n'),
    });
    const [component] = await scan(getComponents, dir);
    expect(component.isStandalone).toBe(false);
  });

  it('does not report a provider spelled out in a regex literal', async () => {
    const dir = workspace({
      'src/a.ts': [
        'const re = /settings=inject(FakeService)/;',
        "@Injectable({ providedIn: 'root' })",
        'export class Real {}',
      ].join('\n'),
    });
    const found = await scan(getProviders, dir);
    expect(found.map((p) => p.token)).toEqual(['Real']);
  });

  it('finds a service behind a second decorator', async () => {
    const dir = workspace({
      'src/a.ts': "@Injectable({ providedIn: 'root' })\n@Trace()\nexport class Api {}",
    });
    const found = await scan(getProviders, dir);
    expect(found.map((p) => p.token)).toContain('Api');
  });

  it('reads providedIn given as a class', async () => {
    const dir = workspace({
      'src/a.ts': '@Injectable({ providedIn: FeatureModule })\nexport class Api {}',
    });
    const [provider] = await scan(getProviders, dir);
    expect(provider.providedIn).toBe('FeatureModule');
  });

  it('stops a type annotation at a parameter boundary', async () => {
    const dir = workspace({
      'src/a.ts': 'class C { constructor(label: string, count = signal(0)) {} }',
    });
    const found = await scan(getSignals, dir);
    expect(found.map((s) => s.name)).toEqual(['count']);
  });

  it('still reads an annotation holding a generic with a comma', async () => {
    const dir = workspace({
      'src/a.ts': 'class C { totals: Signal<Record<string, number>> = signal({}); }',
    });
    const found = await scan(getSignals, dir);
    expect(found.map((s) => s.name)).toContain('totals');
  });

  it('prunes a root reached through a symlinked source root', () => {
    const dir = fixtureDir('pangular-link-');
    mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true });
    symlinkSync(join(dir, 'apps', 'web'), join(dir, 'src'));
    writeFileSync(
      join(dir, 'angular.json'),
      JSON.stringify({ projects: { a: { sourceRoot: 'apps/web/src' } } }),
    );
    expect(sourceRoots(dir)).toHaveLength(1);
  });
});
