// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boundField, locateWritable, writableFields } from '../signal-locator.ts';

const SIGNAL = Symbol('SIGNAL');

interface FakeNode {
  kind: string;
  version: number;
  value: unknown;
  debugName?: string;
}

/** A getter shaped like Angular's: the node under the `SIGNAL` symbol, `set` when writable. */
function fakeSignal(node: FakeNode, writable = true) {
  const getter = Object.assign(() => node.value, { [SIGNAL]: node }) as (() => unknown) & {
    set?: (value: unknown) => void;
  };
  if (writable) {
    getter.set = (value: unknown) => {
      node.value = value;
      node.version++;
    };
  }
  return getter;
}

const ng = { isSignal: (value: unknown) => typeof value === 'function' && SIGNAL in value };

const graphNode = (id: string, n: FakeNode) => ({
  id,
  kind: n.kind,
  label: n.debugName,
  epoch: n.version,
  ...(n.kind === 'linkedSignal' ? {} : { value: n.value }),
});

describe('locateWritable', () => {
  it('skips computed nodes, signal inputs and fields without a signal', () => {
    const name = { kind: 'signal', version: 0, value: 'Ada', debugName: 'name' };
    const total = { kind: 'computed', version: 1, value: 3, debugName: 'total' };
    const label = { kind: 'signal', version: 0, value: 'x', debugName: 'label' };
    const instance = {
      name: fakeSignal(name),
      total: fakeSignal(total, false),
      label: fakeSignal(label, false),
      plain: 3,
    };
    expect(writableFields(ng, instance).map((f) => f.key)).toEqual(['name']);
    const found = locateWritable(ng, instance, [
      graphNode('1', name),
      graphNode('2', total),
      graphNode('3', label),
    ]);
    expect([...found].map(([index, f]) => [index, f.key])).toEqual([[0, 'name']]);
  });

  it('matches unnamed signals by value identity, and waits while two look the same', () => {
    const a = { kind: 'signal', version: 0, value: 0 };
    const b = { kind: 'signal', version: 0, value: 0 };
    const instance = { a: fakeSignal(a), b: fakeSignal(b) };
    expect(locateWritable(ng, instance, [graphNode('1', a), graphNode('2', b)]).size).toBe(0);

    instance.b.set!(5);
    const found = locateWritable(ng, instance, [graphNode('1', a), graphNode('2', b)]);
    expect(found.get(0)?.key).toBe('a');
    expect(found.get(1)?.key).toBe('b');

    // Once bound, the id keeps its field even when the values look the same again.
    instance.a.set!(5);
    instance.a.set!(5);
    b.version = a.version;
    const again = locateWritable(ng, instance, [graphNode('1', a), graphNode('2', b)]);
    expect(again.get(0)?.key).toBe('a');
    expect(boundField(ng, instance, '2')?.key).toBe('b');
  });

  it('matches a linkedSignal by name and version, and forgets a field that was replaced', () => {
    const picked = { kind: 'linkedSignal', version: 2, value: 'x', debugName: 'picked' };
    const instance: Record<string, unknown> = { picked: fakeSignal(picked) };
    expect(locateWritable(ng, instance, [graphNode('7', picked)]).get(0)?.key).toBe('picked');

    instance['picked'] = fakeSignal({ ...picked, version: 9 });
    expect(boundField(ng, instance, '7')).toBeUndefined();
  });

  it('reads no field of an instance whose graph has no writable node', () => {
    let reads = 0;
    const instance = {
      get busy() {
        reads++;
        return 1;
      },
    };
    expect(locateWritable(ng, instance, [{ id: '1', kind: 'computed', epoch: 0 }]).size).toBe(0);
    expect(reads).toBe(0);
  });
});
