// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isRedactedKey,
  secretKeyClassifications,
  setRedaction,
  withRedactionScope,
} from '../forms-privacy.ts';
import { domTree } from '../host-tree.ts';
import { touchesSecret } from '../ngrx-args.ts';
import { createNgrxCollector } from '../ngrx-collector.ts';
import { knownSecrets, rememberSecret } from '../text-redact.ts';

/**
 * Every signal store update runs the redaction rules over the changed slice
 * and the method's arguments. These tests keep that cheap (keys classified
 * once, the page config read once per update) without letting a cached answer
 * outlive a change to the rules.
 */

const SIGNAL = Symbol('SIGNAL');
const STATE_SOURCE = Symbol('STATE_SOURCE');

function writable<T>(initial: T) {
  const node = { value: initial };
  const getter = (() => node.value) as (() => T) & { set(v: T): void };
  (getter as unknown as Record<symbol, unknown>)[SIGNAL] = node;
  getter.set = (v: T) => {
    node.value = v;
  };
  return getter;
}

interface Item {
  id: number;
  label: string;
  packed: boolean;
}

class PackingStore {
  [STATE_SOURCE] = {
    items: writable<Item[]>(
      Array.from({ length: 500 }, (_, id) => ({ id, label: `Item ${id}`, packed: false })),
    ),
    nextId: writable(500),
  };
  add = (label: string) => {
    const source = this[STATE_SOURCE];
    const id = source.nextId();
    source.items.set([...source.items(), { id, label, packed: false }]);
    source.nextId.set(id + 1);
  };
  rename = (id: number, label: string) => {
    const source = this[STATE_SOURCE];
    source.items.set(source.items().map((item) => (item.id === id ? { ...item, label } : item)));
  };
}

function setup() {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  const store = new PackingStore();
  const rootEnv = {
    scopes: new Set(['root']),
    records: new Map<unknown, { value: unknown }>([[PackingStore, { value: store }]]),
    get: () => null,
  };
  const node = { el: root, get: () => null };
  const ng = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? { store } : null),
    ɵgetInjectorMetadata: (inj: unknown) =>
      inj === rootEnv ? { type: 'environment', source: 'R3Injector' } : { type: 'element' },
    ɵgetInjectorResolutionPath: () => [node, rootEnv],
    ɵgetInjectorProviders: () => [],
  };
  const collector = createNgrxCollector(() => ng as never, vi.fn(), domTree());
  collector.collect();
  return { store, collector };
}

const page = globalThis as { __PANGULAR_FORMS__?: unknown };

afterEach(() => {
  delete page.__PANGULAR_FORMS__;
  knownSecrets.clear();
  setRedaction();
});

describe('redaction on the store update hot path', () => {
  it('classifies each key once and reads the page config once per update', () => {
    let reads = 0;
    page.__PANGULAR_FORMS__ = {
      get mask() {
        reads++;
        return [];
      },
    };
    const { store, collector } = setup();
    for (let i = 0; i < 5; i++) store.rename(i, `Warm ${i}`);
    store.add('Warm');
    let classified = secretKeyClassifications();
    reads = 0;
    const updates = 50;
    for (let i = 0; i < updates; i++) store.rename(i % 10, `Renamed ${i}`);
    expect(collector.logSince(0).filter((entry) => entry.type === 'rename')).toHaveLength(55);
    // The same keys (`items`, `id`, `label`, `packed`, the indexes) every time.
    expect(secretKeyClassifications() - classified).toBe(0);
    // Once per update, not once per key: over a thousand keys are checked per update.
    expect(reads).toBeLessThanOrEqual(updates);

    // An add only brings the new item's index.
    classified = secretKeyClassifications();
    for (let i = 0; i < updates; i++) store.add(`Extra item ${i}`);
    expect(secretKeyClassifications() - classified).toBeLessThanOrEqual(updates);
  });

  it('still logs the change and the args of every update', () => {
    const { store, collector } = setup();
    store.add('Charger');
    store.add('Passport');
    const adds = collector.logSince(0).filter((entry) => entry.type === 'add');
    expect(adds.map((entry) => entry.args)).toEqual([['Charger'], ['Passport']]);
    expect(adds[1].diff).toContainEqual({ path: 'nextId', op: 'change', before: 501, after: 502 });
    store.rename(501, 'Visa');
    expect(collector.logSince(0).at(-1)!.diff).toEqual([
      { path: 'items[501].label', op: 'change', before: 'Passport', after: 'Visa' },
    ]);
  });

  it('applies a mask list the page sets or changes in place between updates', () => {
    const config = { mask: [] as string[] };
    page.__PANGULAR_FORMS__ = config;
    const { store, collector } = setup();
    store.add('Before mask');
    page.__PANGULAR_FORMS__ = { mask: ['label'] };
    store.add('Hidden label');
    expect(JSON.stringify(collector.logSince(0).at(-1))).not.toContain('Hidden label');
    store.rename(500, 'Hidden rename');
    expect(collector.logSince(0).at(-1)!.diff).toEqual([
      { path: 'items[500].label', op: 'change', before: '[redacted]', after: '[redacted]' },
    ]);

    // `rename` wrote a masked key, so its args stay masked; the diff shows the label again.
    page.__PANGULAR_FORMS__ = config;
    store.rename(500, 'Shown again');
    expect(collector.logSince(0).at(-1)!.diff).toEqual([
      { path: 'items[500].label', op: 'change', before: 'Hidden rename', after: 'Shown again' },
    ]);
    config.mask.push('label');
    store.rename(500, 'Hidden in place');
    expect(JSON.stringify(collector.logSince(0).at(-1))).not.toContain('Hidden in place');
  });

  it('applies redaction.secretNames and secret values learned between updates', () => {
    const { store, collector } = setup();
    store.add('zebra-777 crossing');
    setRedaction({ secretNames: ['label'] });
    store.rename(500, 'renamed');
    expect(collector.logSince(0).at(-1)!.diff).toEqual([
      { path: 'items[500].label', op: 'change', before: '[redacted]', after: '[redacted]' },
    ]);

    setRedaction();
    store.add('lion-888 crossing');
    rememberSecret('lion-888');
    store.rename(501, 'plain');
    const text = JSON.stringify(collector.logSince(0).at(-1));
    expect(text).not.toContain('lion-888');
    expect(text).toContain('plain');
  });

  it('answers key checks outside an update from the live config', () => {
    expect(isRedactedKey('label')).toBe(false);
    page.__PANGULAR_FORMS__ = { mask: ['label'] };
    expect(isRedactedKey('label')).toBe(true);
    withRedactionScope(() => {
      expect(isRedactedKey('label')).toBe(true);
      expect(isRedactedKey('accessToken')).toBe(true);
    });
    page.__PANGULAR_FORMS__ = { unmask: ['accessToken'] };
    expect(isRedactedKey('label')).toBe(false);
    expect(isRedactedKey('accessToken')).toBe(false);
  });
});

describe('touchesSecret on large slices', () => {
  const items = Array.from({ length: 1000 }, (_, id) => ({ id, label: `Item ${id}` }));

  it('finds a secret in the one item appended after a long shared list', () => {
    const before = { items };
    const after = { items: [...items, { id: 1000, label: 'x', token: 'tok-new-1' }] };
    expect(touchesSecret(before, after, ['items'])).toBe(true);
    const harmless = { items: [...items, { id: 1000, label: 'tok-new-1' }] };
    expect(touchesSecret(before, harmless, ['items'])).toBe(false);
  });

  it('finds a secret past the first 200 nodes of a changed slice', () => {
    const deep = items.map((item) => ({ ...item }));
    const before = { items: deep };
    const changed = [...deep];
    changed[900] = { ...deep[900], label: 'x' };
    (changed[900] as Record<string, unknown>)['apiKey'] = 'key-900-x';
    expect(touchesSecret(before, { items: changed }, ['items'])).toBe(true);
  });

  it('counts a secret moved to another path and a secret field on an array', () => {
    const before = { auth: { a: { token: 'tok-1-x' }, b: {} } };
    const moved = { auth: { a: {}, b: { token: 'tok-1-x' } } };
    expect(touchesSecret(before, moved, ['auth'])).toBe(true);
    const list = Object.assign([...items.slice(0, 3)], { token: 'tok-2-y' });
    expect(touchesSecret({ list: items.slice(0, 3) }, { list }, ['list'])).toBe(true);
  });

  it('pairs Map entries by key and handles keys that print the same', () => {
    const before = { m: new Map<unknown, unknown>([['a', { token: 'tok-3-z' }]]) };
    const after = { m: new Map<unknown, unknown>([['a', { token: 'tok-4-z' }]]) };
    expect(touchesSecret(before, after, ['m'])).toBe(true);
    const clash = {
      m: new Map<unknown, unknown>([
        [1, { token: 'tok-5-z' }],
        ['1', { token: 'tok-5-z' }],
      ]),
    };
    const same = { m: new Map<unknown, unknown>([[1, { token: 'tok-5-z' }]]) };
    expect(touchesSecret(same, clash, ['m'])).toBe(false);
    expect(touchesSecret(same, { m: new Map([[1, { token: 'tok-6-z' }]]) }, ['m'])).toBe(true);
  });
});
