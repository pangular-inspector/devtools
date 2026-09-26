// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { installSignalWriteHook } from '../overlay.ts';
import { MAX_CHANGES, createSignalHistory, type RawSignalNode } from '../signal-history.ts';
import type { SignalGraphNode } from '../types.ts';

const identity = (v: unknown) => v;

function graphNode(
  id: string,
  label: string | undefined,
  epoch: number,
  value: unknown,
  kind: SignalGraphNode['kind'] = 'signal',
): SignalGraphNode {
  return { id, kind, label, epoch, value, watched: false };
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

  it('prunes nodes that left the graph', () => {
    const h = createSignalHistory(identity);
    h.collect([graphNode('a', 'x', 1, 1)]);
    h.collect([]);
    expect(h.collect([graphNode('a', 'x', 1, 1)])['a']).toEqual([
      expect.objectContaining({ source: 'initial' }),
    ]);
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
    write(h.onWrite, two, 'b');
    const out = h.collect([graphNode('x', 'n', 1, 'a'), graphNode('y', 'n', 1, 'b')]);
    expect(out['x']).toEqual([expect.objectContaining({ source: 'initial', value: 'a' })]);
    expect(out['y']).toEqual([expect.objectContaining({ source: 'initial', value: 'b' })]);
  });

  it('serializes written values', () => {
    const h = createSignalHistory((v) => `s:${String(v)}`);
    const raw: RawSignalNode = { debugName: 'n', kind: 'signal', version: 0 };
    h.collect([graphNode('a', 'n', 0, 's:undefined')]);
    write(h.onWrite, raw, 5);
    expect(h.collect([graphNode('a', 'n', 1, 's:5')])['a'][1].value).toBe('s:5');
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
    restore();
    expect(core.get()).toBe(prev);
  });

  it('keeps a hook chained after ours and stops recording', async () => {
    const core = fakeCore();
    const onWrite = vi.fn();
    const restore = await installSignalWriteHook(onWrite, async () => core);
    const later = vi.fn();
    core.setPostSignalSetFn(later);
    restore();
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

  it('returns a no-op when the primitives cannot load', async () => {
    const restore = await installSignalWriteHook(vi.fn(), async () => {
      throw new Error('missing');
    });
    expect(() => restore()).not.toThrow();
  });
});
