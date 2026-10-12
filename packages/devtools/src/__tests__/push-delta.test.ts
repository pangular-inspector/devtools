import { describe, expect, it } from 'vitest';
import {
  CHANGE_DETECTION_SHAPE,
  COMPONENT_TREE_SHAPE,
  FORMS_SHAPE,
  INJECTOR_TREE_SHAPE,
  createDeltaSender,
  type DeltaShape,
} from '../push-delta.ts';
import { createReportDeltas } from '../rpc/report-deltas.ts';

type Node = { id: string; name: string; tag: string; children: Node[]; directives?: string[] };

/** A small seeded random source, so a failing sequence can be replayed. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function syntheticTree(count: number, next: () => number, idPrefix = 'c') {
  const roots: Node[] = [];
  const all: Node[] = [];
  for (let i = 0; i < count; i++) {
    const node: Node = {
      id: `${idPrefix}${i}`,
      name: `Cmp${i % 37}`,
      tag: `app-c${i % 37}`,
      children: [],
    };
    const parent = all.length && next() < 0.9 ? all[Math.floor(next() * all.length)] : null;
    (parent ? parent.children : roots).push(node);
    all.push(node);
  }
  return { roots, all };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Sends each report through a sender and a receiver, and checks the server rebuilt it exactly. */
function roundTrip(shape: DeltaShape, reports: Record<string, unknown>[]) {
  const sender = createDeltaSender(shape);
  const receiver = createReportDeltas(shape);
  const sizes: { full: number; sent: number }[] = [];
  for (const report of reports) {
    const next = sender.next(report, false);
    if (!next.changed && !next.full) continue;
    // What goes over the wire is JSON.
    const message = JSON.parse(JSON.stringify(next.message));
    const receipt = receiver.receive(message);
    expect(receipt.kind).toBe('report');
    if (receipt.kind !== 'report') return sizes;
    expect(JSON.stringify(receipt.report)).toBe(JSON.stringify(report));
    sender.confirm(next.seq);
    sizes.push({ full: JSON.stringify(report).length, sent: JSON.stringify(message).length });
  }
  return sizes;
}

describe('push deltas', () => {
  it('rebuilds a component tree exactly through adds, removals, moves and renames', () => {
    const next = random(7);
    const { roots, all } = syntheticTree(300, next);
    const reports: Record<string, unknown>[] = [];
    const snapshot = () =>
      reports.push({
        pageId: 'p1',
        roots: clone(roots),
        count: all.length,
        detail: next() < 0.5 ? null : { id: all[0]!.id, inputs: [{ name: 'v', value: next() }] },
        url: '/x',
        deferBlocks:
          next() < 0.3
            ? undefined
            : [{ id: 'd1', state: next() < 0.5 ? 'placeholder' : 'complete' }],
      });
    snapshot();
    for (let step = 0; step < 60; step++) {
      const action = next();
      const live = (function collect(list: Node[], out: Node[] = []): Node[] {
        for (const node of list) {
          out.push(node);
          collect(node.children, out);
        }
        return out;
      })(roots);
      const target = live[Math.floor(next() * live.length)]!;
      if (action < 0.3) {
        target.children.push({ id: `n${step}`, name: 'Added', tag: 'app-added', children: [] });
      } else if (action < 0.5) {
        const parent = live.find((node) => node.children.includes(target));
        if (parent) parent.children.splice(parent.children.indexOf(target), 1);
      } else if (action < 0.7) {
        target.name = `Renamed${step}`;
        target.directives = next() < 0.5 ? ['NgClass'] : undefined;
      } else if (action < 0.85) {
        // A move: the same node under another parent.
        const parent = live.find((node) => node.children.includes(target));
        const to = live[Math.floor(next() * live.length)]!;
        const isInside = (node: Node): boolean => node === to || node.children.some(isInside);
        if (parent && !isInside(target)) {
          parent.children.splice(parent.children.indexOf(target), 1);
          to.children.unshift(target);
        }
      } else {
        roots.reverse();
      }
      snapshot();
    }
    const sizes = roundTrip(COMPONENT_TREE_SHAPE, reports);
    expect(sizes.length).toBeGreaterThan(30);
    // After the first full report, a delta is a small part of the tree.
    const later = sizes.slice(1);
    const sent = later.reduce((sum, size) => sum + size.sent, 0);
    const full = later.reduce((sum, size) => sum + size.full, 0);
    expect(sent / full).toBeLessThan(0.25);
  });

  it('rebuilds injector trees, change detection cycles and forms exactly', () => {
    const injectorNode = (id: string, providers: number, children: unknown[] = []) => ({
      injector: { id, type: 'element', name: id, providerCount: providers },
      providers: Array.from({ length: providers }, (_, i) => ({ token: `T${i}`, type: 'class' })),
      children,
    });
    roundTrip(INJECTOR_TREE_SHAPE, [
      {
        pageId: 'p',
        roots: [injectorNode('a', 1, [injectorNode('b', 2)])],
        environment: [injectorNode('e', 3)],
      },
      {
        pageId: 'p',
        roots: [injectorNode('a', 1, [injectorNode('b', 2), injectorNode('c', 0)])],
        environment: [injectorNode('e', 3)],
        zone: 'zoneless',
      },
      {
        pageId: 'p',
        roots: [injectorNode('a', 2)],
        environment: [injectorNode('e', 3)],
        zone: 'zoneless',
        truncated: true,
      },
      { pageId: 'p', roots: [], environment: [] },
    ]);

    const cycle = (id: number) => ({
      id,
      at: id,
      ms: id / 10,
      passes: 1,
      checks: 2,
      components: [],
    });
    const cycles = (from: number, to: number) =>
      Array.from({ length: to - from }, (_, i) => cycle(from + i));
    roundTrip(CHANGE_DETECTION_SHAPE, [
      {
        pageId: 'p',
        supported: true,
        recording: true,
        cycles: cycles(1, 5),
        hosts: { a: 1 },
        components: [],
      },
      {
        pageId: 'p',
        supported: true,
        recording: true,
        cycles: cycles(1, 9),
        hosts: { a: 3, b: 1 },
        components: [{ name: 'A', ms: 1 }],
      },
      // The ring drops its oldest cycles.
      {
        pageId: 'p',
        supported: true,
        recording: true,
        cycles: cycles(4, 12),
        hosts: { b: 1, a: 3 },
        components: [{ name: 'A', ms: 2 }],
        dropped: 3,
      },
      { pageId: 'p', supported: true, recording: false, cycles: [], hosts: {}, components: [] },
    ]);

    const form = (id: string, value: string) => ({
      id,
      kind: 'reactive',
      root: { path: '', value, children: [] },
    });
    const event = (seq: number, count = 1) => ({
      formId: 'f1',
      path: 'name',
      type: 'value',
      timestamp: seq,
      seq,
      count,
    });
    roundTrip(FORMS_SHAPE, [
      { pageId: 'p', forms: [form('f1', 'a')], events: [], setupErrors: [], instrumented: false },
      {
        pageId: 'p',
        forms: [form('f1', 'ab'), form('f2', '')],
        events: [event(1)],
        setupErrors: [],
        instrumented: false,
      },
      // A repeated value merges into the last event, which changes in place.
      {
        pageId: 'p',
        forms: [form('f1', 'abc'), form('f2', '')],
        events: [event(1, 2)],
        setupErrors: [],
        instrumented: true,
      },
      {
        pageId: 'p',
        forms: [form('f2', '')],
        events: [event(1, 2), event(2)],
        setupErrors: ['NG01001'],
        instrumented: true,
        dropped: 1,
      },
    ]);
  });

  it('sends nothing for an unchanged report and keeps the sequence', () => {
    const sender = createDeltaSender(COMPONENT_TREE_SHAPE);
    const receiver = createReportDeltas(COMPONENT_TREE_SHAPE);
    const report = {
      pageId: 'p',
      roots: [{ id: 'a', name: 'A', tag: 'a', children: [] }],
      count: 1,
    };
    const first = sender.next(report, false);
    expect(first.full).toBe(true);
    receiver.receive(first.message);
    sender.confirm(first.seq);
    const again = sender.next(clone(report), false);
    expect(again.changed).toBe(false);
    expect(again.message).toEqual({ pageId: 'p', delta: { base: 1, seq: 1 } });
    // An empty delta is still a valid keepalive.
    expect(receiver.receive(again.message)).toEqual({ kind: 'report', report });
    const moved = sender.next({ ...report, count: 2 }, false);
    expect(moved.message).toEqual({ pageId: 'p', delta: { base: 1, seq: 2, set: { count: 2 } } });
  });

  it('keeps sending full reports until the server confirms one', () => {
    const sender = createDeltaSender(COMPONENT_TREE_SHAPE);
    const one = sender.next({ pageId: 'p', roots: [], count: 0 }, false);
    const two = sender.next({ pageId: 'p', roots: [], count: 1 }, false);
    expect(one.full && two.full).toBe(true);
    // The first answer is stale: the second message is the one to build on.
    sender.confirm(one.seq);
    expect(sender.ready).toBe(false);
    sender.confirm(two.seq);
    expect(sender.next({ pageId: 'p', roots: [], count: 2 }, false).full).toBe(false);
  });

  it('asks for a full report when a delta does not build on what the server holds', () => {
    const receiver = createReportDeltas(COMPONENT_TREE_SHAPE);
    expect(
      receiver.receive({ pageId: 'p', delta: { base: 0, seq: 1, set: { count: 1 } } }),
    ).toEqual({
      kind: 'unknown',
    });
    receiver.receive({ pageId: 'p', roots: [], count: 0, delta: { full: true, seq: 4 } });
    expect(receiver.receive({ pageId: 'p', delta: { base: 3, seq: 5 } })).toEqual({
      kind: 'unknown',
    });
    // The mismatch dropped the page, so the next delta asks again.
    expect(receiver.receive({ pageId: 'p', delta: { base: 4, seq: 5 } })).toEqual({
      kind: 'unknown',
    });
  });

  it('refuses malformed deltas: loops, missing nodes and unknown fields', () => {
    const receiver = createReportDeltas(COMPONENT_TREE_SHAPE);
    const full = () =>
      receiver.receive({
        pageId: 'p',
        roots: [
          {
            id: 'a',
            name: 'A',
            tag: 'a',
            children: [{ id: 'b', name: 'B', tag: 'b', children: [] }],
          },
        ],
        delta: { full: true, seq: 1 },
      });
    full();
    const loop = {
      pageId: 'p',
      delta: { base: 1, seq: 2, trees: { roots: { set: [['b', { id: 'b', children: ['a'] }]] } } },
    };
    expect(receiver.receive(loop).kind).toBe('unknown');
    full();
    const missing = { pageId: 'p', delta: { base: 1, seq: 2, trees: { roots: { roots: ['z'] } } } };
    expect(receiver.receive(missing).kind).toBe('unknown');
    full();
    const unknownList = {
      pageId: 'p',
      delta: { base: 1, seq: 2, lists: { roots: { order: [] } } },
    };
    expect(receiver.receive(unknownList).kind).toBe('unknown');
  });

  it('keeps a __proto__ field a plain field', () => {
    const receiver = createReportDeltas(COMPONENT_TREE_SHAPE);
    receiver.receive({ pageId: 'p', roots: [], delta: { full: true, seq: 1 } });
    const receipt = receiver.receive(
      JSON.parse(
        '{"pageId":"p","delta":{"base":1,"seq":2,"keys":["pageId","roots","__proto__"],"set":{"__proto__":{"polluted":true}}}}',
      ),
    );
    expect(receipt.kind).toBe('report');
    if (receipt.kind !== 'report') return;
    expect(Object.getPrototypeOf(receipt.report)).toBe(Object.prototype);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('falls back to whole fields when list keys repeat', () => {
    const sender = createDeltaSender(FORMS_SHAPE);
    const receiver = createReportDeltas(FORMS_SHAPE);
    const twice = [{ id: 'f' }, { id: 'f' }];
    const steps = [
      { pageId: 'p', forms: [{ id: 'f' }], events: [] },
      { pageId: 'p', forms: twice, events: [] },
      { pageId: 'p', forms: [{ id: 'g' }], events: [] },
    ];
    for (const report of steps) {
      const next = sender.next(report, false);
      const receipt = receiver.receive(JSON.parse(JSON.stringify(next.message)));
      expect(receipt).toEqual({ kind: 'report', report });
      sender.confirm(next.seq);
    }
  });
});
