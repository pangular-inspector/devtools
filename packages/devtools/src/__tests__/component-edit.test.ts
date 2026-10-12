// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  editComponent,
  LOCKED,
  markEditable,
  parsePath,
  type EditDebugNg,
} from '../component-edit.ts';
import { registerComponentEdit } from '../component-edit-overlay.ts';
import { collectComponentTree } from '../component-tree.ts';
import { elementById, elementId } from '../element-id.ts';
import { setRedaction } from '../forms-privacy.ts';

const SIGNAL = Symbol('SIGNAL');

/** Like Angular's signal(): a getter with `set`, `update` and the SIGNAL brand. */
function writable<T>(initial: T) {
  let value = initial;
  const fn = (() => value) as (() => T) & { set(v: T): void; update(f: (v: T) => T): void };
  (fn as unknown as Record<symbol, unknown>)[SIGNAL] = { kind: 'signal' };
  fn.set = vi.fn((v: T) => {
    value = v;
  });
  fn.update = (f) => fn.set(f(value));
  return fn;
}

/** Like input() or computed(): a branded getter without `set`. */
function readonly<T>(value: T) {
  const fn = () => value;
  (fn as unknown as Record<symbol, unknown>)[SIGNAL] = { kind: 'input' };
  return fn;
}

class _Card {
  title = readonly('Paris');
  count = writable(1);
  filters = writable({ query: 'a', page: 2 });
  total = readonly(10);
  price = 120;
  user = { name: 'Ada', tags: ['x', 'y'] };
  apiToken = 'abc';
  session = { token: 'abc', label: 'main' };
  when = new Date(0);
  selected = { emit: () => {} };
  get label() {
    return 'card';
  }
  save() {}
}

function setup(instance: object = new _Card()) {
  document.body.innerHTML = '<app-root ng-version="22.0.0"><app-card></app-card></app-root>';
  const host = document.querySelector('app-card')!;
  const applyChanges = vi.fn();
  const ng: EditDebugNg = {
    getComponent: (el) => (el === host ? instance : null),
    getDirectiveMetadata: () => ({
      inputs: { title: 'title', costInput: 'price' },
      outputs: { selected: 'selected' },
    }),
    isSignal: (v) => typeof v === 'function' && SIGNAL in (v as object),
    applyChanges,
  };
  const id = elementId(host);
  const find = (target: string) => elementById(target);
  return { ng, host, id, instance: instance as _Card, applyChanges, find };
}

describe('editComponent', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    setRedaction({ secretNames: [], unmask: [] });
  });

  it('sets a writable signal with .set() and does not run applyChanges', () => {
    const { ng, id, instance, applyChanges, find } = setup();
    const result = editComponent(ng, { id, path: 'count', value: 5, kind: 'signal' }, find);
    expect(result).toEqual({
      ok: true,
      kind: 'signal',
      component: 'Card',
      path: 'count',
      value: 5,
    });
    expect(instance.count.set).toHaveBeenCalledWith(5);
    expect(instance.count()).toBe(5);
    expect(applyChanges).not.toHaveBeenCalled();
  });

  it('sets a path inside a signal value with a copy, keeping the rest', () => {
    const { ng, id, instance, find } = setup();
    const before = instance.filters();
    const result = editComponent(ng, { id, path: 'filters.query', value: 'b' }, find);
    expect(result).toMatchObject({ ok: true, kind: 'signal', value: 'b' });
    expect(instance.filters()).toEqual({ query: 'b', page: 2 });
    expect(instance.filters()).not.toBe(before);
    expect(before.query).toBe('a');
  });

  it('assigns a plain property and calls ng.applyChanges on the component', () => {
    const { ng, id, instance, applyChanges, find } = setup();
    const result = editComponent(ng, { id, path: 'user.tags[1]', value: 'z' }, find);
    expect(result).toMatchObject({ ok: true, kind: 'property', path: 'user.tags.1', value: 'z' });
    expect(instance.user.tags).toEqual(['x', 'z']);
    expect(applyChanges).toHaveBeenCalledWith(instance);
  });

  it('maps a public input name to its class property', () => {
    const { ng, id, instance, find } = setup();
    const result = editComponent(ng, { id, path: 'costInput', value: 99 }, find);
    expect(result).toMatchObject({ ok: true, path: 'price' });
    expect(instance.price).toBe(99);
  });

  it('refuses a signal input', () => {
    const { ng, id, find } = setup();
    const result = editComponent(ng, { id, path: 'title', value: 'Rome' }, find);
    expect(result).toEqual({
      error: '`title` is a signal input. Its parent binding sets it, so it cannot be written.',
    });
  });

  it('refuses a computed or read-only signal', () => {
    const { ng, id, find } = setup();
    const result = editComponent(ng, { id, path: 'total', value: 3, kind: 'signal' }, find);
    expect('error' in result && result.error).toMatch(/read-only signal/);
  });

  it('refuses the wrong kind with the tool to use', () => {
    const { ng, id, find } = setup();
    expect(editComponent(ng, { id, path: 'count', value: 2, kind: 'property' }, find)).toEqual({
      error: '`count` is a signal. Write it with set-signal.',
    });
    expect(editComponent(ng, { id, path: 'price', value: 2, kind: 'signal' }, find)).toEqual({
      error: '`price` is not a signal. Write it with set-component-property.',
    });
  });

  it('refuses redacted names, config secret names and values that hold redacted data', () => {
    const { ng, id, instance, find } = setup();
    expect(editComponent(ng, { id, path: 'apiToken', value: 'x' }, find)).toMatchObject({
      error: expect.stringMatching(/redacted/),
    });
    expect(editComponent(ng, { id, path: 'session', value: {} }, find)).toMatchObject({
      error: expect.stringMatching(/redacted data/),
    });
    // A sibling of the secret is fine, and the secret stays.
    expect(editComponent(ng, { id, path: 'session.label', value: 'b' }, find)).toMatchObject({
      ok: true,
    });
    expect(instance.session.token).toBe('abc');
    setRedaction({ secretNames: ['price'], unmask: [] });
    expect(editComponent(ng, { id, path: 'price', value: 1 }, find)).toMatchObject({
      error: expect.stringMatching(/redacted/),
    });
    expect(instance.price).toBe(120);
  });

  it('refuses outputs, methods, getters, unknown paths, class instances and unsafe keys', () => {
    const { ng, id, find } = setup();
    const error = (path: string, value: unknown = 1) => {
      const result = editComponent(ng, { id, path, value }, find);
      return 'error' in result ? result.error : 'ok';
    };
    expect(error('selected')).toMatch(/output/);
    expect(error('save')).toMatch(/method/);
    expect(error('label')).toMatch(/getter without a setter/);
    expect(error('missing')).toMatch(/no property/);
    expect(error('user.age')).toMatch(/does not exist/);
    expect(error('when')).toMatch(/not JSON/);
    expect(error('user.__proto__')).toMatch(/cannot be written/);
    expect(error('price', { at: new Date() })).toMatch(/must be JSON/);
  });

  it('answers an unknown or destroyed instance id', () => {
    const { ng, find } = setup();
    expect(editComponent(ng, { id: 'nope', path: 'price', value: 1 }, find)).toEqual({
      error: expect.stringMatching(/No component instance `nope`/),
    });
  });

  it('returns the new value redacted like the detail', () => {
    const { ng, id, find } = setup();
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlc2lnbmF0dXJl';
    const result = editComponent(ng, { id, path: 'user.name', value: jwt }, find);
    expect(result).toMatchObject({ ok: true, value: '[redacted]' });
  });
});

describe('parsePath', () => {
  it('splits dots and brackets and refuses empty parts', () => {
    expect(parsePath('items[0].title')).toEqual(['items', '0', 'title']);
    expect(parsePath('a..b')).toBeNull();
    expect(parsePath('')).toBeNull();
  });
});

describe('markEditable', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('says which inputs and properties can be edited, and why the others cannot', () => {
    const { ng, host } = setup();
    const id = elementId(host);
    const detail = collectComponentTree(ng, { selectedId: id }).detail!;
    const byName = (list: { name: string }[], name: string) => list.find((p) => p.name === name);
    expect(byName(detail.inputs, 'title')).toMatchObject({ locked: LOCKED.signalInput });
    expect(byName(detail.inputs, 'costInput')).toMatchObject({ edit: 'property' });
    const props = detail.properties ?? [];
    expect(byName(props, 'count')).toMatchObject({ edit: 'signal' });
    expect(byName(props, 'total')).toMatchObject({ locked: LOCKED.readonlySignal });
    expect(byName(props, 'user')).toMatchObject({ edit: 'property' });
    expect(byName(props, 'apiToken')).toMatchObject({ locked: LOCKED.redacted });
    expect(byName(props, 'session')).toMatchObject({ locked: LOCKED.redacted });
    expect(byName(props, 'when')).toMatchObject({ locked: LOCKED.notJson });
  });

  it('locks a value the panel shows clipped', () => {
    const { ng } = setup();
    const detail = { inputs: [], properties: [{ name: 'text', prop: 'text' }] };
    markEditable(ng, { text: 'x'.repeat(1000) }, detail);
    expect(detail.properties[0]).toMatchObject({ locked: LOCKED.clipped });
  });
});

describe('registerComponentEdit', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function wire(allowed: boolean) {
    const ctx = setup();
    let handler: ((message: unknown) => unknown) | undefined;
    const call = vi.fn(async () => undefined);
    const edited = vi.fn();
    registerComponentEdit(
      {
        call,
        register: (definition) => {
          handler = definition.handler as (message: unknown) => unknown;
        },
      },
      'page-1',
      { getNg: () => ctx.ng, allowed, edited },
    );
    return { ...ctx, handler: handler!, call, edited };
  }

  it('answers with the result for its own page and refreshes the tree', () => {
    const { handler, call, edited, id, instance } = wire(true);
    handler({ requestId: 'e1', pageId: 'page-1', request: { id, path: 'price', value: 7 } });
    expect(instance.price).toBe(7);
    expect(call).toHaveBeenCalledWith('component-edit-result', {
      requestId: 'e1',
      pageId: 'page-1',
      result: expect.objectContaining({ ok: true, value: 7 }),
    });
    expect(edited).toHaveBeenCalled();
  });

  it('ignores another page and refuses when the action is off', () => {
    const off = wire(false);
    off.handler({ requestId: 'e1', pageId: 'page-2', request: {} });
    expect(off.call).not.toHaveBeenCalled();
    off.handler({
      requestId: 'e2',
      pageId: 'page-1',
      request: { id: off.id, path: 'price', value: 7 },
    });
    expect(off.instance.price).toBe(120);
    expect(off.call).toHaveBeenCalledWith('component-edit-result', {
      requestId: 'e2',
      pageId: 'page-1',
      result: { error: expect.stringMatching(/actions\.components/) },
    });
    expect(off.edited).not.toHaveBeenCalled();
  });
});
