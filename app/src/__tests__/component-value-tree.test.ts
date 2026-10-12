import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';
import {
  childrenOf,
  containerOf,
  editInto,
  editPath,
  editableLeaf,
  nestedMatches,
  pathKey,
  shownPath,
  summary,
} from '../pages/component-value-state';

type Call = (name: string, arg: Record<string, unknown>) => Promise<unknown>;

function fakeClient(call: Call, state: Record<string, unknown> = {}): DevframeRpcClient {
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => state[name] ?? null, on: () => () => {} }),
  };
  return {
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function el(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(fixture: ComponentFixture<unknown>, name: string | RegExp): HTMLButtonElement {
  const found = Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('button')).find((b) => {
    const text = (b.getAttribute('aria-label') ?? b.textContent ?? '').replace(/\s+/g, ' ').trim();
    return typeof name === 'string' ? text === name : name.test(text);
  });
  if (!found) throw new Error(`No button ${name}`);
  return found;
}

function hasButton(fixture: ComponentFixture<unknown>, name: string | RegExp): boolean {
  try {
    button(fixture, name);
    return true;
  } catch {
    return false;
  }
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('value levels', () => {
  it('reads containers, markers and cut lists from a lazy level', () => {
    expect(containerOf({ $collapsed: 'Address', size: 2 })).toEqual({
      kind: 'object',
      type: 'Address',
      size: 2,
      collapsed: true,
    });
    expect(containerOf([1, 2, { $more: 8 }])).toMatchObject({ kind: 'array', size: 10 });
    expect(containerOf([])).toBeNull();
    expect(containerOf('[Object]')).toBeNull();
    expect(childrenOf([1, { $more: 3 }])).toEqual({
      children: [{ key: '0', label: '0', value: 1 }],
      more: 3,
    });
    expect(childrenOf({ $type: 'User', name: 'Ada', $more: 4 })).toEqual({
      children: [{ key: 'name', label: 'name', value: 'Ada' }],
      more: 4,
    });
    expect(childrenOf({ $type: 'Map', size: 3, entries: [['first', 1]] }).children[0]).toEqual({
      key: '0',
      label: '"first"',
      value: 1,
    });
    expect(summary(containerOf({ $type: 'Set', size: 1, values: [1] })!)).toBe('Set (1 value)');
  });

  it('builds edit paths and refuses leaves it cannot write', () => {
    expect(editPath(['user', 'name'])).toBe('user.name');
    expect(editPath(['items', '0', 'title'])).toBe('items.0.title');
    expect(editPath(['user', 'a.b'])).toBeNull();
    expect(shownPath(['items', '0', 'title'], ['array', 'object'])).toBe('items[0].title');
    expect(editableLeaf('Rome')).toBe(true);
    expect(editableLeaf('[redacted]')).toBe(false);
    expect(editableLeaf('[Getter]')).toBe(false);
    expect(editableLeaf('long text…')).toBe(false);
    const map = { kind: 'map', type: 'Map', size: 1, collapsed: false } as const;
    const cls = { kind: 'object', type: 'User', size: 1, collapsed: false } as const;
    expect(editInto('property', map)).toBeNull();
    expect(editInto('signal', cls)).toBeNull();
    expect(editInto('property', cls)).toBe('property');
  });

  it('finds keys in the loaded levels only', () => {
    const levels: Record<string, unknown> = {
      [pathKey(['user', 'profile'])]: { city: 'Rome', zip: '1' },
    };
    const value = {
      name: 'Ada',
      profile: { $collapsed: 'Object', size: 2 },
      other: { $collapsed: 'Object', size: 1 },
    };
    const at = (path: readonly string[]) => levels[pathKey(path)];
    expect(nestedMatches(['user'], value, at, 'CITY')).toEqual([['user', 'profile', 'city']]);
    expect(nestedMatches(['user'], value, at, 'secret')).toEqual([]);
  });
});

describe('ComponentTree value expansion', () => {
  const detail = {
    id: 'c1',
    name: 'Trips',
    tag: 'app-trips',
    path: 'app-trips',
    inputs: [{ name: 'title', prop: 'title', value: 'Paris', locked: 'Signal input.' }],
    outputs: [{ name: 'picked', prop: 'picked', listened: true }],
    properties: [
      {
        name: 'user',
        prop: 'user',
        value: { name: 'Ada', profile: { $collapsed: 'Profile', size: 2 } },
        locked: 'Too large to edit as a whole. Open it to edit the values inside.',
        editInside: 'property',
      },
      {
        name: 'items',
        prop: 'items',
        value: [...Array.from({ length: 30 }, (_, i) => i), { $more: 15 }],
        locked: 'Too large to edit in the panel.',
        editInside: 'signal',
        kind: 'signal',
      },
      { name: 'count', prop: 'count', value: 1, edit: 'property' },
    ],
    listeners: [],
    directives: [],
    dependencies: [],
  };

  async function open(call: Call, expanded?: Record<string, unknown>) {
    const page = {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'Trips', tag: 'app-trips', children: [] }],
      count: 1,
      reportedAt: 1,
      detail: expanded ? { ...detail, expanded } : detail,
    };
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(call, { 'component-tree': { pages: { p1: page } } }),
    );
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    expect(fixture.componentInstance.selectedId()).toBe('c1');
    return fixture;
  }

  function valueCalls(call: ReturnType<typeof vi.fn<Call>>) {
    return call.mock.calls.filter(([name]) => name === 'request-component-value');
  }

  it('opens the first level without asking the page, then reads a nested level on demand', async () => {
    const call = vi.fn<Call>(async (name) =>
      name === 'request-component-value'
        ? { ok: true, value: { $type: 'Profile', city: 'Rome', tags: [] } }
        : [],
    );
    const fixture = await open(call);
    // The name holds the visible summary; aria-expanded carries the state.
    const toggle = button(fixture, 'user: Object (2 keys)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('Object (2 keys)');
    toggle.click();
    await settle(fixture);
    expect(button(fixture, 'user: Object (2 keys)').getAttribute('aria-expanded')).toBe('true');
    expect(valueCalls(call)).toHaveLength(0);
    expect(el(fixture).textContent).toContain('"Ada"');

    button(fixture, 'profile: Profile (2 keys)').click();
    await settle(fixture);
    expect(valueCalls(call)[0][1]).toEqual({
      pageId: 'p1',
      request: { id: 'c1', path: ['user', 'profile'], limit: 30, watch: true },
    });
    expect(el(fixture).textContent).toContain('"Rome"');

    // Closing it tells the page to stop reading it.
    button(fixture, 'profile: Profile (2 keys)').click();
    await settle(fixture);
    expect(valueCalls(call).at(-1)![1]).toEqual({
      pageId: 'p1',
      request: { id: 'c1', path: ['user', 'profile'], forget: true },
    });
    expect(el(fixture).textContent).not.toContain('"Rome"');
  });

  it('lists the next entries of a long level with Show more', async () => {
    const call = vi.fn<Call>(async (name) =>
      name === 'request-component-value'
        ? { ok: true, value: Array.from({ length: 45 }, (_, i) => i) }
        : [],
    );
    const fixture = await open(call);
    button(fixture, 'items: Array (45 items)').click();
    await settle(fixture);
    const more = button(fixture, /^Show 15 more \(15 not listed\)$/);
    more.click();
    await settle(fixture);
    expect(valueCalls(call)[0][1]).toEqual({
      pageId: 'p1',
      request: { id: 'c1', path: ['items'], limit: 130, watch: true },
    });
    expect(hasButton(fixture, /^Show \d+ more/)).toBe(false);
    expect(el(fixture).querySelectorAll('app-value-tree li').length).toBeGreaterThanOrEqual(45);
  });

  it('keeps keyboard focus in the list when the last Show more goes away', async () => {
    const call = vi.fn<Call>(async (name) =>
      name === 'request-component-value'
        ? { ok: true, value: Array.from({ length: 45 }, (_, i) => i) }
        : [],
    );
    const fixture = await open(call);
    button(fixture, 'items: Array (45 items)').click();
    await settle(fixture);
    const more = button(fixture, /^Show 15 more/);
    more.focus();
    more.click();
    await settle(fixture);
    expect(hasButton(fixture, /^Show \d+ more/)).toBe(false);
    // Focus moves to a control among the entries instead of falling to the page.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.closest('ul')?.getAttribute('aria-label')).toBe('items entries');
  });

  it('moves focus to the first new entry that has a control', async () => {
    const call = vi.fn<Call>(async (name) =>
      name === 'request-component-value'
        ? {
            ok: true,
            value: [
              ...Array.from({ length: 30 }, (_, i) => i),
              ...Array.from({ length: 15 }, () => ({ $collapsed: 'Object', size: 1 })),
            ],
          }
        : [],
    );
    const fixture = await open(call);
    button(fixture, 'items: Array (45 items)').click();
    await settle(fixture);
    const more = button(fixture, /^Show 15 more/);
    more.focus();
    more.click();
    await settle(fixture);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('30: Object (1 key)');
  });

  it('shows the levels the page pushed, and says why a level could not be read', async () => {
    const call = vi.fn<Call>(async (name) =>
      name === 'request-component-value'
        ? { error: 'No component instance `c1` is on this page. It may have been destroyed.' }
        : [],
    );
    const fixture = await open(call, { [pathKey(['user'])]: { name: 'Grace', extra: true } });
    button(fixture, /^user: Object/).click();
    await settle(fixture);
    expect(el(fixture).textContent).toContain('"Grace"');
    expect(el(fixture).textContent).not.toContain('"Ada"');
    // The pushed level has no profile any more, so open a fresh tree on another value.
    button(fixture, 'items: Array (45 items)').click();
    await settle(fixture);
    expect(hasButton(fixture, /^Show 15 more/)).toBe(true);
    button(fixture, /^Show 15 more/).click();
    await settle(fixture);
    // A failed load keeps what was listed.
    expect(hasButton(fixture, /^Show 15 more/)).toBe(true);
  });

  it('edits a value inside an opened object through set-component-property', async () => {
    const call = vi.fn<Call>(async (name) =>
      name === 'request-component-edit' ? { ok: true } : [],
    );
    const fixture = await open(call);
    button(fixture, /^user: Object/).click();
    await settle(fixture);
    button(fixture, 'Edit user.name').click();
    await settle(fixture);
    const field = el(fixture).querySelector<HTMLInputElement>('app-value-tree input')!;
    expect(field.value).toBe('"Ada"');
    type(field, '"Grace"');
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);
    expect(call).toHaveBeenCalledWith('request-component-edit', {
      pageId: 'p1',
      request: { id: 'c1', path: 'user.name', value: 'Grace', kind: 'property' },
    });
    // The whole object is too large to replace, so only its values offer Edit.
    expect(hasButton(fixture, 'Edit user')).toBe(false);
    expect(el(fixture).textContent).toContain('Open it to edit the values inside.');
  });

  it('reads the whole value before editing an object as a whole', async () => {
    const call = vi.fn<Call>(async (name) =>
      name === 'request-component-value' ? { ok: true, value: { name: 'Ada', tags: ['a'] } } : [],
    );
    const fixture = await open(call);
    // `count` is a number, so it shows as before, with no toggle.
    expect(hasButton(fixture, /^count: /)).toBe(false);
    expect(hasButton(fixture, 'Edit count')).toBe(true);
    const page = fixture.componentInstance.page()!;
    const small = {
      name: 'small',
      prop: 'small',
      value: { name: 'Ada', tags: { $collapsed: 'Array', size: 1 } },
      edit: 'property' as const,
      editInside: 'property' as const,
    };
    fixture.componentInstance.pages.set({
      p1: { ...page, detail: { ...page.detail!, properties: [small] } },
    });
    await settle(fixture);
    button(fixture, 'Edit small').click();
    await settle(fixture);
    expect(valueCalls(call)[0][1]).toEqual({
      pageId: 'p1',
      request: { id: 'c1', path: ['small'], depth: 5, limit: 100 },
    });
    const field = el(fixture).querySelector<HTMLInputElement>('app-value-tree input')!;
    expect(field.value).toBe('{"name":"Ada","tags":["a"]}');
  });

  it.each([
    ['text the page clipped', { name: 'Ada', bio: `${'x'.repeat(300)}…` }],
    ['a budget marker', { name: 'Ada', tags: ['a', '[Truncated]'] }],
    ['a redacted value', { name: 'Ada', token: '[redacted]' }],
    ['a level left collapsed', { name: 'Ada', tags: { $collapsed: 'Array', size: 1 } }],
    ['a Map', { name: 'Ada', seen: { $type: 'Map', size: 1, entries: [['a', 1]] } }],
  ])('refuses a whole edit when the value read has %s', async (_, value) => {
    const call = vi.fn<Call>(async (name) =>
      name === 'request-component-value' ? { ok: true, value } : [],
    );
    const fixture = await open(call);
    const page = fixture.componentInstance.page()!;
    const small = {
      name: 'small',
      prop: 'small',
      value: { name: 'Ada', tags: { $collapsed: 'Array', size: 1 } },
      edit: 'property' as const,
      editInside: 'property' as const,
    };
    fixture.componentInstance.pages.set({
      p1: { ...page, detail: { ...page.detail!, properties: [small] } },
    });
    await settle(fixture);
    button(fixture, 'Edit small').click();
    await settle(fixture);
    expect(el(fixture).querySelector('app-value-tree input')).toBeNull();
    expect(el(fixture).textContent).toContain(
      'Too large to edit as a whole. Open it to edit the values inside.',
    );
  });

  it('filters values by name and by loaded nested keys, with a count and a no-match state', async () => {
    const call = vi.fn<Call>(async () => []);
    const fixture = await open(call);
    const filter = el(fixture).querySelector<HTMLInputElement>(
      'input[aria-label^="Filter inputs, outputs and properties"]',
    )!;
    type(filter, 'coun');
    await settle(fixture);
    const names = () =>
      Array.from(el(fixture).querySelectorAll('.prop-name')).map(
        (n) => n.textContent!.trim().split(/\s+/)[0],
      );
    expect(names()).toEqual(['count']);
    expect(el(fixture).querySelector('.prop-filter .count')?.textContent).toBe('1 of 5');
    expect(el(fixture).querySelector('.prop-filter [role="status"]')?.textContent).toBe(
      '1 of 5 values match.',
    );

    // A key inside the first level of `user` keeps it, opened to the match.
    type(filter, 'NAME');
    await settle(fixture);
    expect(names()).toEqual(['user']);
    expect(button(fixture, 'user: Object (2 keys)').getAttribute('aria-expanded')).toBe('true');
    expect(el(fixture).textContent).toContain('"Ada"');
    expect(hasButton(fixture, /^profile: /)).toBe(false);

    type(filter, 'zzz');
    await settle(fixture);
    expect(el(fixture).textContent).toContain('No inputs, outputs or properties match “zzz”');
    button(fixture, 'Clear filter').click();
    await settle(fixture);
    expect(filter.value).toBe('');
    expect(document.activeElement).toBe(filter);
    expect(names()).toEqual(['title', 'user', 'items', 'count']);

    type(filter, 'title');
    await settle(fixture);
    filter.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(fixture);
    expect(filter.value).toBe('');
  });
});
