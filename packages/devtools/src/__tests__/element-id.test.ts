import { afterEach, describe, expect, it, vi } from 'vitest';
import { elementById, elementId, elementIdCount, pruneElementIds } from '../element-id.ts';

const attached = () => ({ isConnected: true });
const detached = () => ({ isConnected: false });

function fill(count: number, make: () => object = detached) {
  for (let i = 0; i < count; i++) elementId(make());
}

describe('element ids', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    pruneElementIds();
  });

  it('keeps the map bounded when elements are detached and nothing prunes it', () => {
    const keeper = attached();
    const keeperId = elementId(keeper);
    fill(5000);
    expect(elementIdCount()).toBeLessThan(1200);
    expect(elementId(keeper)).toBe(keeperId);
    expect(elementById(keeperId)).toBe(keeper);
  });

  it('keeps ids of connected elements stable across many sweeps', () => {
    const live = Array.from({ length: 300 }, attached);
    const first = live.map((el) => elementId(el));
    fill(4000);
    expect(elementById(first[0])).toBe(live[0]);
    expect(live.map((el) => elementId(el))).toEqual(first);
  });

  it('keeps connected non-host elements after a host-only prune and an automatic sweep', () => {
    const hosts = new WeakSet<object>();
    const host = attached();
    hosts.add(host);
    pruneElementIds(
      (el) => hosts.has(el) && (el as { isConnected?: boolean }).isConnected === true,
    );
    const other = attached();
    const otherId = elementId(other);
    const gone = detached();
    const goneId = elementId(gone);
    fill(4000);
    expect(elementById(otherId)).toBe(other);
    expect(elementById(goneId)).toBeNull();
    expect(elementId(other)).toBe(otherId);
  });

  it('keeps objects that have no isConnected until they are collected', () => {
    const view = { typeName: 'Label' };
    const id = elementId(view);
    fill(4000);
    expect(elementById(id, () => true)).toBe(view);
    expect(elementId(view)).toBe(id);
  });

  it('drops entries whose reference is dead', () => {
    const dead = new WeakSet<object>();
    const Real = WeakRef;
    vi.stubGlobal(
      'WeakRef',
      class<T extends object> {
        private readonly ref: WeakRef<T>;
        constructor(target: T) {
          this.ref = new Real(target);
        }
        deref() {
          const target = this.ref.deref();
          return target && dead.has(target) ? undefined : target;
        }
      },
    );
    const doomed = attached();
    const doomedId = elementId(doomed);
    dead.add(doomed);
    fill(4000, attached);
    expect(elementById(doomedId)).toBeNull();
  });
});
