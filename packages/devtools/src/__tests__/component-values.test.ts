// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectComponentTree, type ComponentDebugNg } from '../component-tree.ts';
import { registerComponentValues } from '../component-values-overlay.ts';
import {
  MAX_WATCHED_PATHS,
  createComponentValues,
  readComponentValue,
  toValueRequest,
  valuePathKey,
  type ComponentValueRequest,
} from '../component-values.ts';
import { editabilityOf, LOCKED } from '../component-edit.ts';
import { elementById, elementId } from '../element-id.ts';
import { serialize } from '../serialize.ts';

const SIGNAL = Symbol('SIGNAL');

function signalOf<T>(value: T) {
  const fn = () => value;
  (fn as unknown as Record<symbol, unknown>)[SIGNAL] = { value };
  return fn;
}

class Store {}
class Address {
  city = 'Rome';
  zip = '00100';
}
class Profile {
  address = new Address();
  nicknames = ['Ada'];
}

class Trips {
  heading = signalOf('Trips');
  user = { name: 'Ada', profile: new Profile(), apiKey: 'sk-live-1' };
  items = Array.from({ length: 45 }, (_, i) => ({ id: i, tags: ['a', 'b'] }));
  cache = new Map<unknown, unknown>([
    ['first', { hits: 1 }],
    ['password', { hits: 2 }],
  ]);
  seen = new Set([{ id: 7 }]);
  filters = signalOf({ query: 'paris', page: { size: 10 } });
  store = new Store();
  self: unknown = null;
  created = new Date(0);
  select() {}
}

function setup(instance: object = new Trips(), extra: Partial<ComponentDebugNg> = {}) {
  document.body.innerHTML = '<app-trips></app-trips>';
  const host = document.querySelector('app-trips')!;
  const directives = new Map<Element, object[]>();
  const ng: ComponentDebugNg = {
    getComponent: (el) => (el === host ? instance : null),
    getDirectives: (el) => directives.get(el) ?? [],
    getDirectiveMetadata: (target) =>
      target === instance
        ? { inputs: { title: 'heading' }, outputs: {} }
        : { inputs: { tooltip: 'text' }, outputs: {} },
    getInjector: () => ({}),
    isSignal: (v) => typeof v === 'function' && SIGNAL in (v as object),
    ...extra,
  };
  const id = elementId(host);
  return { ng, host, id, instance, directives };
}

function readAt(
  ctx: ReturnType<typeof setup>,
  path: string[],
  more: Partial<ComponentValueRequest> = {},
) {
  return readComponentValue(ctx.ng, ctx.host, { id: ctx.id, path, ...more });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('serialize lazy levels', () => {
  it('collapses nested containers into markers and counts what a list left out', () => {
    const value = {
      list: [1, 2],
      map: new Map([['a', 1]]),
      set: new Set([1]),
      user: new Address(),
      empty: [],
      none: {},
      text: '[Object]',
    };
    expect(serialize(value, { depth: 1, lazy: true })).toEqual({
      list: { $collapsed: 'Array', size: 2 },
      map: { $collapsed: 'Map', size: 1 },
      set: { $collapsed: 'Set', size: 1 },
      user: { $collapsed: 'Address', size: 2 },
      empty: [],
      none: {},
      text: '[Object]',
    });
    expect(serialize([1, 2, 3], { items: 2, lazy: true })).toEqual([1, 2, { $more: 1 }]);
    expect(serialize({ a: 1, b: 2, c: 3 }, { keys: 1, lazy: true })).toEqual({ a: 1, $more: 2 });
    // Without `lazy`, the old text markers stay.
    expect(serialize({ list: [1] }, { depth: 1 })).toEqual({ list: '[Array(1)]' });
  });

  it('shows an ancestor inside the value as [Circular]', () => {
    const parent: Record<string, unknown> = { name: 'p' };
    const child = { parent, name: 'c' };
    expect(serialize(child, { ancestors: [parent] })).toEqual({ parent: '[Circular]', name: 'c' });
  });
});

describe('readComponentValue', () => {
  it('reads one level at a path through objects, class instances and arrays', () => {
    const ctx = setup();
    expect(readAt(ctx, ['user'])).toEqual({
      ok: true,
      component: 'Trips',
      path: ['user'],
      value: { name: 'Ada', profile: { $collapsed: 'Profile', size: 2 }, apiKey: '[redacted]' },
    });
    expect(readAt(ctx, ['user', 'profile', 'address'])).toMatchObject({
      value: { $type: 'Address', city: 'Rome', zip: '00100' },
    });
    expect(readAt(ctx, ['items', '3'])).toMatchObject({
      value: { id: 3, tags: { $collapsed: 'Array', size: 2 } },
    });
    expect(readAt(ctx, ['items', '3', 'tags'])).toMatchObject({ value: ['a', 'b'] });
  });

  it('cuts a level at its limit and reads deeper with depth', () => {
    const ctx = setup();
    const first = readAt(ctx, ['items']);
    expect(first.ok && (first.value as unknown[]).length).toBe(31);
    expect(first.ok && (first.value as unknown[]).at(-1)).toEqual({ $more: 15 });
    const all = readAt(ctx, ['items'], { limit: 100 });
    expect(all.ok && (all.value as unknown[]).length).toBe(45);
    expect(readAt(ctx, ['user'], { depth: 3 })).toMatchObject({
      value: { profile: { address: { city: 'Rome' }, nicknames: ['Ada'] } },
    });
  });

  it('unwraps signals and reads inputs by their public name', () => {
    const ctx = setup();
    expect(readAt(ctx, ['title'])).toMatchObject({ ok: true, value: 'Trips' });
    expect(readAt(ctx, ['filters', 'page'])).toMatchObject({ value: { size: 10 } });
  });

  it('opens Map and Set entries by index and refuses a redacted Map key', () => {
    const ctx = setup();
    expect(readAt(ctx, ['cache'])).toMatchObject({
      value: {
        $type: 'Map',
        size: 2,
        entries: [
          ['first', { $collapsed: 'Object', size: 1 }],
          ['password', '[redacted]'],
        ],
      },
    });
    expect(readAt(ctx, ['cache', '0'])).toMatchObject({ value: { hits: 1 } });
    expect(readAt(ctx, ['cache', '1'])).toEqual({ error: expect.stringMatching(/redacted/) });
    expect(readAt(ctx, ['cache', '9'])).toEqual({ error: expect.stringMatching(/no entry 9/) });
    expect(readAt(ctx, ['seen', '0'])).toMatchObject({ value: { id: 7 } });
  });

  it('refuses paths through redacted names, so a secret is never read', () => {
    const ctx = setup({ apiToken: { value: 'x' }, user: { password: { hint: 'pet' } } });
    expect(readAt(ctx, ['apiToken'])).toEqual({ error: expect.stringMatching(/redacted/) });
    expect(readAt(ctx, ['user', 'password'])).toEqual({ error: expect.stringMatching(/redacted/) });
  });

  it('never runs a getter on the way', () => {
    const getter = vi.fn(() => ({ leaked: true }));
    const nested = {};
    Object.defineProperty(nested, 'lazy', { get: getter, enumerable: true });
    const ctx = setup({ nested });
    expect(readAt(ctx, ['nested'])).toMatchObject({ value: { lazy: '[Getter]' } });
    expect(readAt(ctx, ['nested', 'lazy'])).toEqual({
      error: expect.stringMatching(/getter, which the devtools never run/),
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it('shows a cycle back to an open object, or the component, as [Circular]', () => {
    const trips = new Trips();
    const loop: Record<string, unknown> = { name: 'loop' };
    loop['again'] = loop;
    trips.self = { owner: trips, loop };
    const ctx = setup(trips);
    expect(readAt(ctx, ['self'])).toMatchObject({
      value: { owner: '[Circular]', loop: { $collapsed: 'Object', size: 2 } },
    });
    expect(readAt(ctx, ['self', 'loop'])).toMatchObject({
      value: { name: 'loop', again: '[Circular]' },
    });
    // Following the cycle keeps working, one level at a time.
    expect(readAt(ctx, ['self', 'loop', 'again'])).toMatchObject({ value: '[Circular]' });
  });

  it('refuses methods, injected services, internals, outputs and values with nothing inside', () => {
    const trips = new Trips();
    const ctx = setup(trips, {
      ɵgetDependenciesFromInjectable: () => ({
        dependencies: [{ token: Store, value: trips.store, flags: {} }],
      }),
      getDirectiveMetadata: () => ({ inputs: {}, outputs: { picked: 'picked' } }),
    });
    expect(readAt(ctx, ['select'])).toEqual({ error: expect.stringMatching(/no property/) });
    expect(readAt(ctx, ['store'])).toEqual({ error: expect.stringMatching(/injected service/) });
    expect(readAt(ctx, ['__ngContext__'])).toEqual({ error: expect.stringMatching(/internal/) });
    expect(readAt(ctx, ['picked'])).toEqual({ error: expect.stringMatching(/output/) });
    expect(readAt(ctx, ['created', 'x'])).toEqual({
      error: expect.stringMatching(/nothing inside/),
    });
    expect(readAt(ctx, ['user', 'name', 'x'])).toEqual({
      error: expect.stringMatching(/no object/),
    });
    expect(readAt(ctx, ['user', 'missing'])).toEqual({ error: expect.stringMatching(/no key/) });
  });

  it('reads the inputs of a directive on the host', () => {
    const ctx = setup();
    ctx.directives.set(ctx.host, [ctx.instance, { text: { lines: ['a'] } }]);
    expect(readAt(ctx, ['tooltip'], { directive: 0 })).toMatchObject({
      value: { lines: { $collapsed: 'Array', size: 1 } },
    });
    expect(readAt(ctx, ['other'], { directive: 0 })).toEqual({
      error: expect.stringMatching(/no input/),
    });
    expect(readAt(ctx, ['tooltip'], { directive: 3 })).toEqual({
      error: expect.stringMatching(/no directive 3/),
    });
  });

  it('says so when the instance went away', () => {
    const ctx = setup();
    expect(readComponentValue(ctx.ng, null, { id: 'c99', path: ['user'] })).toEqual({
      error: expect.stringMatching(/No component instance `c99`.*destroyed/),
    });
  });

  it('validates requests and caps their limits', () => {
    expect(toValueRequest({ id: 'c1', path: [] })).toMatch(/Pass a path/);
    expect(toValueRequest({ id: 'c1', path: ['a', 3] })).toMatch(/Pass a path/);
    expect(toValueRequest({ path: ['a'] })).toMatch(/instance id/);
    expect(toValueRequest({ id: 'c1', path: ['a'], directive: -1 })).toMatch(/directive/);
    expect(toValueRequest({ id: 'c1', path: ['a'], limit: 1e9, depth: 99 })).toEqual({
      id: 'c1',
      path: ['a'],
      limit: 1000,
      depth: 5,
    });
  });
});

describe('opened levels', () => {
  it('reads opened levels again on each push, and forgets a level with the ones below it', () => {
    const ctx = setup();
    const values = createComponentValues({
      getNg: () => ctx.ng,
      find: (id) => elementById(id),
    });
    expect(values.handle({ id: ctx.id, path: ['user'], watch: true }).changed).toBe(true);
    expect(values.handle({ id: ctx.id, path: ['user', 'profile'], watch: true }).changed).toBe(
      true,
    );
    values.handle({ id: ctx.id, path: ['items'], watch: true, limit: 40 });
    (ctx.instance as Trips).user.name = 'Grace';

    const tree = collectComponentTree(ctx.ng, { selectedId: ctx.id, withDetail: values.attach });
    const expanded = tree.detail!.expanded!;
    expect(expanded[valuePathKey(['user'])]).toMatchObject({ name: 'Grace' });
    expect(expanded[valuePathKey(['user', 'profile'])]).toMatchObject({ $type: 'Profile' });
    expect((expanded[valuePathKey(['items'])] as unknown[]).length).toBe(41);

    expect(values.handle({ id: ctx.id, path: ['user'], forget: true }).changed).toBe(true);
    expect(values.watchedPaths()).toEqual([valuePathKey(['items'])]);
  });

  it('starts over for another instance, drops the oldest past the cap, and keeps failures out', () => {
    const ctx = setup();
    const values = createComponentValues({ getNg: () => ctx.ng, find: (id) => elementById(id) });
    values.handle({ id: 'c-old', path: ['user'], watch: true });
    expect(values.watchedPaths()).toEqual([]);
    for (let i = 0; i < MAX_WATCHED_PATHS + 2; i++) {
      values.handle({ id: ctx.id, path: ['items', String(i)], watch: true });
    }
    expect(values.watchedPaths()).toHaveLength(MAX_WATCHED_PATHS);
    expect(values.watchedPaths()[0]).toBe(valuePathKey(['items', '2']));
    // The detail of another instance gets nothing.
    const detail = { id: 'other' } as Parameters<typeof values.attach>[0];
    values.attach(detail, ctx.host);
    expect(detail.expanded).toBeUndefined();
  });

  it('answers component-value for its own page only, and asks for a push when levels change', () => {
    const ctx = setup();
    let handler: ((message: unknown) => unknown) | undefined;
    const call = vi.fn(async () => undefined);
    const changed = vi.fn();
    registerComponentValues(
      {
        call,
        register: (definition) => {
          handler = definition.handler as (message: unknown) => unknown;
        },
      },
      'page-1',
      { getNg: () => ctx.ng, changed },
    );
    handler!({ requestId: 'v1', pageId: 'page-2', request: { id: ctx.id, path: ['user'] } });
    expect(call).not.toHaveBeenCalled();
    handler!({
      requestId: 'v2',
      pageId: 'page-1',
      request: { id: ctx.id, path: ['user'], watch: true },
    });
    expect(call).toHaveBeenCalledWith('component-value-result', {
      requestId: 'v2',
      pageId: 'page-1',
      result: expect.objectContaining({
        ok: true,
        value: expect.objectContaining({ name: 'Ada' }),
      }),
    });
    expect(changed).toHaveBeenCalledTimes(1);
    handler!({ requestId: 'v3', pageId: 'page-1', request: { id: ctx.id, path: ['nope'] } });
    expect(call).toHaveBeenLastCalledWith('component-value-result', {
      requestId: 'v3',
      pageId: 'page-1',
      result: { error: expect.stringMatching(/no property/) },
    });
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('editing inside opened values', () => {
  it('offers paths inside a value it cannot replace whole', () => {
    const ctx = setup({
      filters: { city: 'Rome', sessionToken: 'abc' },
      big: { list: Array.from({ length: 200 }, (_, i) => i) },
      small: { name: 'Ada', tags: ['a'] },
      when: new Map([['a', 1]]),
    });
    const of = (prop: string) => editabilityOf(ctx.ng, ctx.instance, prop, [prop], false);
    expect(of('filters')).toEqual({ locked: LOCKED.redacted, editInside: 'property' });
    expect(of('big')).toEqual({ locked: LOCKED.nested, editInside: 'property' });
    expect(of('small')).toEqual({ edit: 'property', editInside: 'property' });
    expect(of('when')).toEqual({ locked: LOCKED.notJson });
  });
});
