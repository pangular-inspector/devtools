// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boundField, locateWritable, writableFields } from '../signal-locator.ts';

const SIGNAL = Symbol('SIGNAL');

interface Link {
  producer: FakeNode;
  consumer: FakeNode;
  nextProducer?: Link;
  nextConsumer?: Link;
}

interface FakeNode {
  kind: string;
  version: number;
  value?: unknown;
  debugName?: string;
  producers?: Link;
  consumers?: Link;
}

const node = (kind: string, value: unknown, debugName?: string, version = 0): FakeNode => ({
  kind,
  version,
  value,
  ...(debugName ? { debugName } : {}),
});

/** Records that `consumer` reads `producer`, the way Angular links a live consumer. */
function reads(consumer: FakeNode, ...producers: FakeNode[]) {
  for (const producer of producers) {
    const link: Link = { producer, consumer };
    let last = consumer.producers;
    while (last?.nextProducer) last = last.nextProducer;
    if (last) last.nextProducer = link;
    else consumer.producers = link;
    let tail = producer.consumers;
    while (tail?.nextConsumer) tail = tail.nextConsumer;
    if (tail) tail.nextConsumer = link;
    else producer.consumers = link;
  }
}

/** A getter shaped like Angular's: the node under the `SIGNAL` symbol, `set` when writable. */
function fakeSignal(n: FakeNode, writable = true) {
  const getter = Object.assign(() => n.value, { [SIGNAL]: n }) as (() => unknown) & {
    set?: (value: unknown) => void;
  };
  if (writable) {
    getter.set = (value: unknown) => {
      n.value = value;
      n.version++;
    };
  }
  return getter;
}

const ng = { isSignal: (value: unknown) => typeof value === 'function' && SIGNAL in value };

/** What `ɵgetSignalGraph` reports for these roots: depth-first, producers in link order. */
function graphOf(...roots: FakeNode[]) {
  const order: FakeNode[] = [];
  const visit = (n: FakeNode) => {
    if (order.includes(n)) return;
    order.push(n);
    for (let l = n.producers; l; l = l.nextProducer) visit(l.producer);
  };
  roots.forEach(visit);
  const nodes = order.map((n, i) => ({
    id: String(i + 1),
    kind: n.kind,
    label: n.debugName,
    epoch: n.version,
    ...(n.kind === 'signal' || n.kind === 'computed' ? { value: n.value } : {}),
  }));
  const edges: { consumer: number; producer: number }[] = [];
  order.forEach((n, consumer) => {
    for (let l = n.producers; l; l = l.nextProducer) {
      edges.push({ consumer, producer: order.indexOf(l.producer) });
    }
  });
  return { nodes, edges };
}

const keys = (found: Map<number, { key: string }>) =>
  [...found].map(([index, f]) => [index, f.key]);

describe('locateWritable', () => {
  it('skips computed nodes, signal inputs and fields without a signal', () => {
    const name = node('signal', 'Ada', 'name');
    const label = node('signal', 'x', 'label');
    const total = node('computed', 3, 'total', 1);
    reads(total, name);
    const template = node('template', undefined);
    reads(template, name, total, label);
    const instance = {
      name: fakeSignal(name),
      total: fakeSignal(total, false),
      label: fakeSignal(label, false),
      plain: 3,
    };
    expect(writableFields(ng, instance).map((f) => f.key)).toEqual(['name']);
    const { nodes, edges } = graphOf(template);
    expect(keys(locateWritable(ng, instance, nodes, edges))).toEqual([[1, 'name']]);
  });

  it('tells apart unnamed signals with the same value by where the graph reads them', () => {
    const a = node('signal', 0);
    const b = node('signal', 0);
    const doubled = node('computed', 0);
    reads(doubled, b);
    const template = node('template', undefined);
    reads(template, a, doubled);
    const instance = { a: fakeSignal(a), b: fakeSignal(b) };
    const { nodes, edges } = graphOf(template);
    const found = locateWritable(ng, instance, nodes, edges);
    expect(keys(found)).toEqual([
      [1, 'a'],
      [3, 'b'],
    ]);
    expect(boundField(ng, instance, nodes[3].id)?.key).toBe('b');
  });

  it('binds no field to a service signal that looks the same when the graph never reads the field', () => {
    const own = node('signal', false, 'loading');
    const service = node('signal', false, 'loading');
    const template = node('template', undefined);
    reads(template, service);
    const instance = { loading: fakeSignal(own) };
    const { nodes, edges } = graphOf(template);
    expect(locateWritable(ng, instance, nodes, edges).size).toBe(0);
    expect(boundField(ng, instance, nodes[1].id)).toBeUndefined();
  });

  it('binds no field when its root fits two places in the graph', () => {
    const own = node('signal', 1, 'n');
    const other = node('signal', 1, 'n');
    const mine = node('effect', undefined);
    const theirs = node('effect', undefined);
    reads(mine, own);
    reads(theirs, other);
    const instance = { n: fakeSignal(own) };
    const { nodes, edges } = graphOf(mine, theirs);
    expect(locateWritable(ng, instance, nodes, edges).size).toBe(0);
  });

  it('drops a binding the next collect no longer proves', () => {
    const picked = node('linkedSignal', 'x', 'picked', 2);
    const template = node('template', undefined);
    reads(template, picked);
    const instance: Record<string, unknown> = { picked: fakeSignal(picked) };
    const graph = graphOf(template);
    expect(locateWritable(ng, instance, graph.nodes, graph.edges).get(1)?.key).toBe('picked');
    expect(boundField(ng, instance, '2')?.key).toBe('picked');

    // The field now holds a look-alike the template does not read.
    instance['picked'] = fakeSignal({ ...picked, consumers: undefined });
    expect(boundField(ng, instance, '2')).toBeUndefined();
    expect(locateWritable(ng, instance, graph.nodes, graph.edges).size).toBe(0);
    instance['picked'] = fakeSignal(picked);
    expect(boundField(ng, instance, '2')).toBeUndefined();
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
