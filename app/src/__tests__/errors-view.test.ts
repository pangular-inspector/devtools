import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleEntry, ErrorGroup } from '../pages/errors-types';

const connection = vi.hoisted(() => ({ resolve: (_client: unknown) => {} }));

vi.mock('devframe/client', () => ({
  connectDevframe: () =>
    new Promise((resolve) => {
      connection.resolve = resolve;
    }),
}));

const { App } = await import('../app');
const { ErrorsInspector } = await import('../pages/errors-inspector');
const { errorsPages, defaultErrorsPage } = await import('../pages/errors-types');

const group = (extra: Partial<ErrorGroup> = {}): ErrorGroup => ({
  id: 'e1',
  message: 'Error: No seats left on trip 42',
  name: 'Error',
  count: 3,
  firstAt: 1_000,
  lastAt: 2_000,
  sources: ['handler'],
  stack: 'Error: No seats left\n    at _TripCard.book (main.js:10:5)',
  owner: { id: 'c1-7', name: 'TripCard' },
  ...extra,
});

const entry = (id: number, extra: Partial<ConsoleEntry> = {}): ConsoleEntry => ({
  id,
  level: 'log',
  text: `line ${id}`,
  at: 1_000 + id,
  count: 1,
  ...extra,
});

/** The shape the server sends: groups and entries keyed by id. */
function wirePage(
  pageId: string,
  errors: ErrorGroup[],
  console: ConsoleEntry[],
  extra: Record<string, unknown> = {},
) {
  return {
    pageId,
    url: `/${pageId}`,
    title: `Trips ${pageId}`,
    reportedAt: 5_000,
    handler: 'wrapped',
    errors: Object.fromEntries(errors.map((e) => [e.id, e])),
    console: Object.fromEntries(console.map((e) => [String(e.id), e])),
    dropped: { errors: 0, console: 0 },
    ...extra,
  };
}

function fakeClient(value: unknown, configs: Record<string, unknown> = {}) {
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'errors' ? value : null),
        on: () => () => {},
      }),
  };
  return {
    status: 'connected',
    connectionMeta: { configs },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const host = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<unknown>) =>
  (host(fixture).textContent ?? '').replace(/\s+/g, ' ');

async function mount(value: unknown) {
  const fixture = TestBed.createComponent(ErrorsInspector);
  fixture.componentRef.setInput('rpc', fakeClient(value));
  document.body.append(host(fixture));
  await settle(fixture);
  return fixture;
}

function button(fixture: ComponentFixture<unknown>, name: string): HTMLButtonElement {
  const found = [...host(fixture).querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(name),
  );
  if (!found) throw new Error(`No button ${name}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = '';
  location.hash = '';
  sessionStorage.clear();
});

describe('the Errors tab', () => {
  it('says how to get data when no page reports', async () => {
    const fixture = await mount({ pages: {} });
    expect(text(fixture)).toContain('No page reports errors yet.');
  });

  it('lists errors with count, code link, stack collapsed and a Show component link', async () => {
    const fixture = await mount({
      pages: {
        p1: wirePage(
          'p1',
          [
            group(),
            group({
              id: 'e2',
              message: 'Error: NG0100: ExpressionChangedAfterItHasBeenCheckedError',
              code: 'NG0100',
              docUrl: 'https://angular.dev/errors/NG0100',
              lastAt: 3_000,
              count: 1,
              owner: undefined,
            }),
            group({ id: 'e3', message: 'NG0303: unknown', code: 'NG0303', lastAt: 500 }),
          ],
          [],
        ),
      },
    });
    const items = [...host(fixture).querySelectorAll('ol.errors > li')];
    expect(items.map((li) => li.querySelector('.message')?.textContent)).toEqual([
      'Error: NG0100: ExpressionChangedAfterItHasBeenCheckedError',
      'Error: No seats left on trip 42',
      'NG0303: unknown',
    ]);
    const link = items[0]!.querySelector<HTMLAnchorElement>('a.chip.code')!;
    expect(link.href).toBe('https://angular.dev/errors/NG0100');
    expect(link.target).toBe('_blank');
    // An undocumented code is shown, without a link.
    expect(items[2]!.querySelector('a.chip.code')).toBeNull();
    expect(items[2]!.querySelector('.chip.code')?.textContent?.trim()).toBe('NG0303');
    expect(items[1]!.querySelector('.times')?.getAttribute('aria-label')).toBe('3 times');
    const details = items[1]!.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('Stack');

    const shown: unknown[] = [];
    fixture.componentInstance.showComponent.subscribe((focus) => shown.push(focus));
    button(fixture, 'Show component').click();
    expect(shown).toEqual([{ id: 'c1-7', pageId: 'p1' }]);
    expect(text(fixture)).toContain('3 of 3 errors');
  });

  it('filters by message and offers Clear filter when nothing matches', async () => {
    const fixture = await mount({ pages: { p1: wirePage('p1', [group()], []) } });
    const search = host(fixture).querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(text(fixture)).toContain('No error matches “zzz”.');
    button(fixture, 'Clear filters').click();
    await settle(fixture);
    expect(host(fixture).querySelectorAll('ol.errors > li')).toHaveLength(1);
    expect(document.activeElement).toBe(search);
  });

  it('shows the empty state and the unwrapped handler notice', async () => {
    const fixture = await mount({ pages: { p1: wirePage('p1', [], [], { handler: 'none' }) } });
    expect(text(fixture)).toContain('No errors since the page loaded.');
    expect(text(fixture)).toContain("Angular's ErrorHandler isn't wrapped");
  });

  it('shows the console log newest first, with a level filter and repeat counts', async () => {
    const fixture = await mount({
      pages: {
        p1: wirePage(
          'p1',
          [],
          [
            entry(1, { text: 'Loaded trips', count: 4 }),
            entry(2, {
              level: 'warn',
              text: 'NG0913: image too big',
              code: 'NG0913',
              docUrl: 'https://angular.dev/errors/NG0913',
            }),
            entry(3, { level: 'error', text: 'Failed to save' }),
          ],
        ),
      },
    });
    button(fixture, 'Console').click();
    await settle(fixture);
    const rows = () =>
      [...host(fixture).querySelectorAll('ol.console > li .text')].map((t) => t.textContent);
    expect(rows()).toEqual(['Failed to save', 'NG0913: image too big', 'Loaded trips']);
    expect(host(fixture).querySelector('ol.console a.chip.code')?.getAttribute('href')).toBe(
      'https://angular.dev/errors/NG0913',
    );
    expect(text(fixture)).toContain('4×');
    fixture.componentInstance.level.set('warn');
    await settle(fixture);
    expect(rows()).toEqual(['NG0913: image too big']);
    expect(text(fixture)).toContain('1 of 3 calls');
    expect(button(fixture, 'Console').getAttribute('aria-pressed')).toBe('true');
  });

  it('merges pages under All pages and picks the panel page when it reports', () => {
    const value = {
      pages: {
        a: wirePage('a', [group({ lastAt: 10 })], []),
        b: { ...wirePage('b', [group({ id: 'e9', lastAt: 20 })], []), reportedAt: 9_000 },
      },
    };
    const pages = errorsPages(value);
    expect(pages.map((p) => p.pageId)).toEqual(['b', 'a']);
    expect(defaultErrorsPage(pages, 'a')).toBe('a');
    expect(defaultErrorsPage(pages, null)).toBe('all');
    expect(defaultErrorsPage(pages.slice(0, 1), null)).toBe('b');
  });
});

describe('the Errors tab in the panel', () => {
  it('appears in the tab bar, opens the Components tab from Show component, and goes with its inspector', async () => {
    const open = async (configs: Record<string, unknown>) => {
      location.hash = '#tab=errors';
      const fixture = TestBed.createComponent(App);
      document.body.append(host(fixture));
      await settle(fixture);
      connection.resolve(fakeClient({ pages: { p1: wirePage('p1', [group()], []) } }, configs));
      await settle(fixture);
      return fixture;
    };
    const fixture = await open({});
    const names = [...host(fixture).querySelectorAll('nav button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(names).toContain('Errors');
    expect(host(fixture).querySelector('nav button.active')?.textContent?.trim()).toBe('Errors');
    button(fixture, 'Show component').click();
    await settle(fixture);
    expect(host(fixture).querySelector('nav button.active')?.textContent?.trim()).toBe(
      'Components',
    );
    fixture.destroy();
    document.body.innerHTML = '';

    const off = await open({ pangular: { inspectors: { errors: false } } });
    const offNames = [...host(off).querySelectorAll('nav button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(offNames).not.toContain('Errors');
  });
});
