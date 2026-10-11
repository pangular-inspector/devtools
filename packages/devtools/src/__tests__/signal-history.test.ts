// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_CHANGES,
  MAX_NODES,
  createSignalHistory,
  installSignalWriteHook,
  type RawSignalNode,
} from '../signal-history.ts';
import type { SignalGraphNode } from '../types.ts';

const identity = (v: unknown) => v;

function graphNode(
  id: string,
  label: string | undefined,
  epoch: number,
  value: unknown,
  kind: SignalGraphNode['kind'] = 'signal',
): SignalGraphNode {
  return { id, kind, label, epoch, value };
}

function write(onWrite: (n: RawSignalNode) => void, raw: RawSignalNode, value: unknown) {
  raw.value = value;
  raw.version = (raw.version ?? 0) + 1;
  onWrite(raw);
}

describe('createSignalHistory', () => {
  it('records the first snapshot as initial', () => {
    const h = createSignalHistory(identity, () => 1);
    const out = h.collect([graphNode('a', 'count', 0, 0)]);
    expect(out['a']).toEqual([{ epoch: 0, value: 0, at: 1, source: 'initial' }]);
  });

  it('merges every write between snapshots', () => {
    const h = createSignalHistory(identity);
    const raw: RawSignalNode = { debugName: 'count', kind: 'signal', value: 0, version: 0 };
    h.collect([graphNode('a', 'count', 0, 0)]);
    write(h.onWrite, raw, 1);
    write(h.onWrite, raw, 2);
    write(h.onWrite, raw, 3);
    const out = h.collect([graphNode('a', 'count', 3, 3)]);
    expect(out['a'].map((c) => [c.value, c.source])).toEqual([
      [0, 'initial'],
      [1, 'write'],
      [2, 'write'],
      [3, 'write'],
    ]);
  });

  it('reports skipped values as missed for sampled nodes', () => {
    const h = createSignalHistory(identity);
    h.collect([graphNode('c', 'total', 1, 10, 'computed')]);
    const out = h.collect([graphNode('c', 'total', 4, 40, 'computed')]);
    expect(out['c'][1]).toMatchObject({ epoch: 4, value: 40, source: 'sample', missed: 2 });
  });

  it('adds nothing when the epoch is unchanged', () => {
    const h = createSignalHistory(identity);
    h.collect([graphNode('a', 'x', 2, 'v')]);
    expect(h.collect([graphNode('a', 'x', 2, 'v')])['a']).toHaveLength(1);
  });

  it('caps each history list', () => {
    const h = createSignalHistory(identity);
    for (let i = 0; i < MAX_CHANGES + 10; i++) h.collect([graphNode('a', 'x', i, i)]);
    const list = h.collect([graphNode('a', 'x', MAX_CHANGES + 10, 'last')])['a'];
    expect(list).toHaveLength(MAX_CHANGES);
    expect(list.at(-1)?.value).toBe('last');
  });

  it('keeps counting changes past the list cap', () => {
    const h = createSignalHistory(identity);
    const raw: RawSignalNode = { debugName: 'count', kind: 'signal', value: 0, version: 0 };
    h.collect([graphNode('a', 'count', 0, 0)]);
    for (let i = 1; i <= 500; i++) write(h.onWrite, raw, i);
    const list = h.collect([graphNode('a', 'count', 500, 500)])['a'];
    expect(list).toHaveLength(MAX_CHANGES);
    expect(h.changesOf('a')).toBe(500);
    h.collect([graphNode('a', 'count', 510, 510)]);
    expect(h.changesOf('a')).toBe(510);
  });

  it('counts no change for the initial value', () => {
    const h = createSignalHistory(identity);
    h.collect([graphNode('a', 'x', 3, 'v')]);
    expect(h.changesOf('a')).toBe(0);
    expect(h.changesOf('unknown')).toBe(0);
  });

  it('records resource status changes', () => {
    const h = createSignalHistory(identity);
    h.collect([graphNode('resource:1', 'trips', 1, 'loading', 'resource')]);
    const out = h.collect([graphNode('resource:1', 'trips', 3, 'resolved', 'resource')]);
    expect(out['resource:1'].map((c) => [c.value, c.source, c.missed])).toEqual([
      ['loading', 'initial', undefined],
      ['resolved', 'sample', 1],
    ]);
    expect(h.changesOf('resource:1')).toBe(2);
  });

  it('keeps history of nodes that left the graph, so switching components back keeps it', () => {
    const h = createSignalHistory(identity);
    h.collect([graphNode('a', 'x', 1, 1)]);
    h.collect([graphNode('a', 'x', 2, 2)]);
    expect(h.collect([graphNode('b', 'y', 0, 0)])['a']).toBeUndefined();
    expect(h.collect([graphNode('a', 'x', 2, 2)])['a'].map((c) => c.value)).toEqual([1, 2]);
  });

  it('forgets the least recently seen nodes past the cap', () => {
    const h = createSignalHistory(identity);
    h.collect([graphNode('first', 'x', 1, 1)]);
    for (let i = 0; i < MAX_NODES; i++) h.collect([graphNode(`n${i}`, 'y', 1, i)]);
    expect(h.collect([graphNode('first', 'x', 1, 1)])['first']).toEqual([
      expect.objectContaining({ source: 'initial' }),
    ]);
    expect(h.collect([graphNode('n1', 'y', 1, 1)])['n1']).toHaveLength(1);
  });

  it('skips effects and unnamed writes', () => {
    const h = createSignalHistory(identity);
    h.onWrite({ kind: 'signal', value: 1, version: 1 });
    const out = h.collect([
      graphNode('e', 'fx', 1, undefined, 'effect'),
      graphNode('a', undefined, 1, 1),
    ]);
    expect(out['e']).toBeUndefined();
    expect(out['a']).toEqual([expect.objectContaining({ source: 'initial' })]);
  });

  it('does not bind ambiguous same-name signals', () => {
    const h = createSignalHistory(identity);
    const one: RawSignalNode = { debugName: 'n', kind: 'signal', version: 0 };
    const two: RawSignalNode = { debugName: 'n', kind: 'signal', version: 0 };
    write(h.onWrite, one, 'a');
    write(h.onWrite, two, 'a');
    const out = h.collect([graphNode('x', 'n', 1, 'a'), graphNode('y', 'n', 1, 'a')]);
    expect(out['x']).toEqual([expect.objectContaining({ source: 'initial', value: 'a' })]);
    expect(out['y']).toEqual([expect.objectContaining({ source: 'initial', value: 'a' })]);
  });

  it('tells same-name signals apart by value', () => {
    const h = createSignalHistory(identity);
    const one: RawSignalNode = { debugName: 'n', kind: 'signal', version: 0 };
    const two: RawSignalNode = { debugName: 'n', kind: 'signal', version: 0 };
    write(h.onWrite, one, 'a');
    write(h.onWrite, two, 'b');
    const out = h.collect([graphNode('x', 'n', 1, 'a'), graphNode('y', 'n', 1, 'b')]);
    expect(out['x']).toEqual([expect.objectContaining({ source: 'write', value: 'a' })]);
    expect(out['y']).toEqual([expect.objectContaining({ source: 'write', value: 'b' })]);
  });

  it("does not attach another signal's writes to a node without its own track", () => {
    const h = createSignalHistory(identity, () => 1);
    const rowB: RawSignalNode = { debugName: 'count', kind: 'signal', value: 'Beta', version: 1 };
    h.onWrite(rowB);
    const a = graphNode('A', 'count', 1, 'Alpha');
    expect(h.collect([a])['A']).toEqual([{ epoch: 1, value: 'Alpha', at: 1, source: 'initial' }]);
    write(h.onWrite, rowB, 'Gamma');
    expect(h.collect([a])['A'].map((c) => c.value)).toEqual(['Alpha']);
  });

  it('drops a binding once the track no longer matches the node', () => {
    const h = createSignalHistory(identity, () => 1);
    const rowB: RawSignalNode = { debugName: 'count', kind: 'signal', value: 'Alpha', version: 1 };
    h.onWrite(rowB);
    h.collect([graphNode('A', 'count', 1, 'Alpha')]);
    write(h.onWrite, rowB, 'Gamma');
    write(h.onWrite, rowB, 'Delta');
    const out = h.collect([graphNode('A', 'count', 1, 'Alpha')])['A'];
    expect(out.map((c) => [c.epoch, c.value])).toEqual([[1, 'Alpha']]);
    const later = h.collect([graphNode('A', 'count', 5, 'Omega')])['A'];
    expect(later.map((c) => [c.epoch, c.value, c.source])).toEqual([
      [1, 'Alpha', 'write'],
      [5, 'Omega', 'sample'],
    ]);
  });

  it('drops a binding when the bound track reaches the same epoch with another value', () => {
    const h = createSignalHistory(identity, () => 1);
    const rowB: RawSignalNode = { debugName: 'count', kind: 'signal', value: 'Alpha', version: 1 };
    h.onWrite(rowB);
    h.collect([graphNode('A', 'count', 1, 'Alpha')]);
    write(h.onWrite, rowB, 'Beta');
    const out = h.collect([graphNode('A', 'count', 2, 'Gamma')])['A'];
    expect(out.map((c) => c.value)).not.toContain('Beta');
    expect(out.at(-1)).toMatchObject({ epoch: 2, value: 'Gamma', source: 'sample' });
  });

  it('never appends a write newer than the node epoch', () => {
    const h = createSignalHistory(identity);
    const raw: RawSignalNode = { debugName: 'n', kind: 'signal', value: 0, version: 0 };
    h.collect([graphNode('a', 'n', 0, 0)]);
    write(h.onWrite, raw, 1);
    h.collect([graphNode('a', 'n', 1, 1)]);
    write(h.onWrite, raw, 2);
    raw.version = 1;
    const out = h.collect([graphNode('a', 'n', 1, 1)])['a'];
    expect(out.map((c) => c.epoch)).toEqual([0, 1]);
  });

  it('matches values with the snapshot serializer', () => {
    const h = createSignalHistory(
      (v) => `h:${String(v)}`,
      Date.now,
      (v) => `g:${String(v)}`,
    );
    const raw: RawSignalNode = { debugName: 'n', kind: 'signal', version: 0 };
    h.collect([graphNode('a', 'n', 0, 'g:undefined')]);
    write(h.onWrite, raw, 5);
    expect(h.collect([graphNode('a', 'n', 1, 'g:5')])['a'][1]).toMatchObject({
      value: 'h:5',
      source: 'write',
    });
  });

  it('serializes written values', () => {
    const h = createSignalHistory((v) => `s:${String(v)}`);
    const raw: RawSignalNode = { debugName: 'n', kind: 'signal', version: 0 };
    h.collect([graphNode('a', 'n', 0, 's:undefined')]);
    write(h.onWrite, raw, 5);
    expect(h.collect([graphNode('a', 'n', 1, 's:5')])['a'][1].value).toBe('s:5');
  });

  it('passes the signal name so secret-named writes can be redacted', () => {
    const h = createSignalHistory((v, name) => (name === 'password' ? '[redacted]' : v));
    const raw: RawSignalNode = { debugName: 'password', kind: 'signal', version: 0 };
    h.collect([graphNode('a', 'password', 0, '[redacted]')]);
    write(h.onWrite, raw, 'hunter2');
    const out = h.collect([graphNode('a', 'password', 1, '[redacted]')]);
    expect(out['a'].map((c) => c.value)).toEqual(['[redacted]', '[redacted]']);
  });

  it('sends only changes newer than the last push unless asked for everything', () => {
    let at = 0;
    const h = createSignalHistory(identity, () => ++at);
    const first = h.collectDelta([graphNode('a', 'count', 0, 0), graphNode('b', 'other', 0, 'x')]);
    expect(Object.keys(first)).toEqual(['a', 'b']);
    const quiet = h.collectDelta([graphNode('a', 'count', 0, 0), graphNode('b', 'other', 0, 'x')]);
    expect(quiet).toEqual({});
    const next = h.collectDelta([graphNode('a', 'count', 2, 2), graphNode('b', 'other', 0, 'x')]);
    expect(next).toEqual({ a: [expect.objectContaining({ epoch: 2, value: 2 })] });
    const full = h.collectDelta(
      [graphNode('a', 'count', 2, 2), graphNode('b', 'other', 0, 'x')],
      true,
    );
    expect(full['a'].map((c) => c.epoch)).toEqual([0, 2]);
    expect(full['b']).toHaveLength(1);
  });

  it('resends the changes of a push that failed once the cursor is rolled back', () => {
    let at = 0;
    const h = createSignalHistory(identity, () => ++at);
    h.collectDelta([graphNode('a', 'count', 0, 0)]);
    const { changes: lost, rollback } = h.collectDeltaWithRollback([graphNode('a', 'count', 2, 2)]);
    expect(lost['a'].map((c) => c.epoch)).toEqual([2]);
    rollback();
    const retry = h.collectDelta([graphNode('a', 'count', 3, 3)]);
    expect(retry['a'].map((c) => c.epoch)).toEqual([2, 3]);
    expect(h.collectDelta([graphNode('a', 'count', 3, 3)])).toEqual({});
  });

  it('resends what an older overlapping push lost even when the newer push succeeded', () => {
    let at = 0;
    const h = createSignalHistory(identity, () => ++at);
    h.collectDelta([graphNode('a', 'count', 0, 0)]);
    const older = h.collectDeltaWithRollback([graphNode('a', 'count', 2, 2)]);
    const newer = h.collectDeltaWithRollback([graphNode('a', 'count', 3, 3)]);
    expect(newer.changes['a'].map((c) => c.epoch)).toEqual([3]);
    older.rollback();
    const retry = h.collectDelta([graphNode('a', 'count', 3, 3)]);
    expect(retry['a'].map((c) => c.epoch)).toEqual([2, 3]);
  });
});

describe('installSignalWriteHook', () => {
  function fakeCore() {
    let current: ((n: RawSignalNode) => void) | null = null;
    const setPostSignalSetFn = (fn: typeof current) => {
      const prev = current;
      current = fn;
      return prev;
    };
    return { setPostSignalSetFn, fire: (n: RawSignalNode) => current?.(n), get: () => current };
  }

  it('chains the previous hook and restores it', async () => {
    const core = fakeCore();
    const prev = vi.fn();
    core.setPostSignalSetFn(prev);
    const onWrite = vi.fn();
    const restore = await installSignalWriteHook(onWrite, async () => core);
    core.fire({ debugName: 'x' });
    expect(prev).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenCalledTimes(1);
    restore!();
    expect(core.get()).toBe(prev);
  });

  it('keeps a hook chained after ours and stops recording', async () => {
    const core = fakeCore();
    const onWrite = vi.fn();
    const restore = await installSignalWriteHook(onWrite, async () => core);
    const later = vi.fn();
    core.setPostSignalSetFn(later);
    restore!();
    expect(core.get()).toBe(later);
    core.fire({ debugName: 'x' });
    expect(onWrite).not.toHaveBeenCalled();
  });

  it('swallows errors from the recorder', async () => {
    const core = fakeCore();
    await installSignalWriteHook(
      () => {
        throw new Error('boom');
      },
      async () => core,
    );
    expect(() => core.fire({ debugName: 'x' })).not.toThrow();
  });

  it('returns null when the primitives cannot load', async () => {
    const restore = await installSignalWriteHook(vi.fn(), async () => {
      throw new Error('missing');
    });
    expect(restore).toBeNull();
  });

  it('returns null when the primitives lack the write hook', async () => {
    expect(await installSignalWriteHook(vi.fn(), async () => ({}) as never)).toBeNull();
  });

  it('returns a restore function when the hook installs', async () => {
    expect(await installSignalWriteHook(vi.fn(), async () => fakeCore())).toBeTypeOf('function');
  });
});
