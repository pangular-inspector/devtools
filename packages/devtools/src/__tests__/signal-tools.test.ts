import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import { routerActionText } from '../rpc/router-tools.ts';
import { SIGNAL_TOOL_MAX, signalGraphText } from '../rpc/signal-tools.ts';
import type { SignalChange, SignalGraph } from '../types.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown>) =>
    ((await ctx.agent.invoke(`pangular:${tool}`, args)) as { markdown: string }).markdown;
  return { ctx, push, call };
}

const component = { id: 'c1', name: 'App', tag: 'app-root', path: 'app-root' };

/** A chain s0 <- s1 <- s2 ... where each node consumes the one before it. */
function bigGraph(nodes = 400, perNode = 50): SignalGraph {
  const history: Record<string, SignalChange[]> = {};
  for (let i = 0; i < nodes; i++) {
    history[`n${i}`] = Array.from({ length: perNode }, (_, k) => ({
      epoch: k,
      value: { label: `value ${k} of node ${i}`, items: [k, k + 1, k + 2] },
      at: 1_700_000_000_000 + k,
      source: 'write' as const,
    }));
  }
  return {
    nodes: Array.from({ length: nodes }, (_, i) => ({
      id: `n${i}`,
      kind: i % 2 ? ('computed' as const) : ('signal' as const),
      label: `s${i}`,
      epoch: perNode,
      value: { text: 'x'.repeat(40), i },
    })),
    edges: Array.from({ length: nodes - 1 }, (_, i) => ({ consumer: i + 1, producer: i })),
    componentSelector: 'app-root',
    component,
    history,
  };
}

function smallGraph(): SignalGraph {
  // count <- doubled <- label, and count <- logEffect; unrelated stays apart.
  return {
    nodes: [
      { id: 'a', kind: 'signal', label: 'count', epoch: 2, value: 2 },
      { id: 'b', kind: 'computed', label: 'doubled', epoch: 2, value: 4 },
      { id: 'c', kind: 'computed', label: 'label', epoch: 2, value: 'four' },
      { id: 'd', kind: 'effect', label: 'logEffect', epoch: 2 },
      { id: 'e', kind: 'signal', label: 'unrelated', epoch: 0, value: true },
    ],
    edges: [
      { consumer: 1, producer: 0 },
      { consumer: 2, producer: 1 },
      { consumer: 3, producer: 0 },
    ],
    componentSelector: 'app-root',
    component,
    resources: [
      { id: 'r1', name: 'user', named: true, epoch: 1, nodeIds: ['e'] },
      { id: 'r2', name: 'cart', named: true, epoch: 1, nodeIds: ['c'] },
    ],
    history: {
      a: [{ epoch: 1, value: 1, at: 1, source: 'write' }],
      c: [{ epoch: 1, value: 'two', at: 1, source: 'write' }],
      e: [{ epoch: 0, value: true, at: 1, source: 'initial' }],
      r1: [{ epoch: 1, value: 'resolved', at: 1, source: 'write' }],
    },
  };
}

describe('signalGraphText', () => {
  it('returns a small graph as plain JSON, unchanged', () => {
    const graph = smallGraph();
    expect(JSON.parse(signalGraphText(graph))).toEqual(graph);
  });

  it('cuts a 400 node graph with long histories under the cap and says what it left out', () => {
    const graph = bigGraph();
    const full = JSON.stringify(graph, null, 2);
    expect(full.length).toBeGreaterThan(1_000_000);
    const text = signalGraphText(graph);
    expect(text.length).toBeLessThanOrEqual(SIGNAL_TOOL_MAX);
    expect(text).toMatch(/Cut to fit 20,000 characters/);
    expect(text).toMatch(/left out all 20000 history entries/);
    expect(text).toMatch(/kept the first \d+ of 400 nodes and left out the other \d+/);
    expect(text).toContain('Pass `node`');
    // What is kept still parses and its edges point at kept nodes.
    const kept = JSON.parse(text.slice(0, text.lastIndexOf('\n\n_Cut'))) as SignalGraph;
    expect(kept.nodes.length).toBeGreaterThan(0);
    for (const e of kept.edges) {
      expect(kept.nodes[e.consumer]).toBeDefined();
      expect(kept.nodes[e.producer]).toBeDefined();
    }
  });

  it('keeps fewer history entries before it drops nodes', () => {
    const text = signalGraphText(bigGraph(20, 50));
    expect(text).toMatch(/kept the last \d+ history entries per node and left out \d+ older ones/);
    expect(text).not.toMatch(/nodes and left out/);
    const kept = JSON.parse(text.slice(0, text.lastIndexOf('\n\n_Cut'))) as SignalGraph;
    expect(kept.nodes).toHaveLength(20);
  });

  it('narrows to one node and its direct producers and consumers', () => {
    const view = JSON.parse(signalGraphText(smallGraph(), { node: 'doubled' })) as SignalGraph;
    expect(view.nodes.map((n) => n.label)).toEqual(['count', 'doubled', 'label']);
    expect(view.edges).toEqual([
      { consumer: 1, producer: 0 },
      { consumer: 2, producer: 1 },
    ]);
    expect(view.resources?.map((r) => r.id)).toEqual(['r2']);
    expect(Object.keys(view.history ?? {})).toEqual(['a', 'c']);
  });

  it('matches `node` by id, keeps only edges that touch it, and names nodes when none match', () => {
    const view = JSON.parse(signalGraphText(smallGraph(), { node: 'a' })) as SignalGraph;
    expect(view.nodes.map((n) => n.id)).toEqual(['a', 'b', 'd']);
    expect(view.edges).toEqual([
      { consumer: 1, producer: 0 },
      { consumer: 2, producer: 0 },
    ]);
    const missing = signalGraphText(smallGraph(), { node: 'nope' });
    expect(missing).toMatch(/No signal node `nope`/);
    expect(missing).toContain('`doubled`');
  });

  it('drops resource references to nodes it left out', () => {
    const graph = smallGraph();
    graph.resources![1]!.nodeIds = ['c', 'e'];
    const view = JSON.parse(signalGraphText(graph, { node: 'doubled' })) as SignalGraph;
    expect(view.resources).toEqual([expect.objectContaining({ id: 'r2', nodeIds: ['c'] })]);
  });

  it('keeps a no-match answer within the budget', () => {
    expect(signalGraphText(smallGraph(), { node: 'x'.repeat(30_000) }).length).toBe(
      SIGNAL_TOOL_MAX,
    );
  });

  it('drops history with `history: false`', () => {
    const view = JSON.parse(signalGraphText(smallGraph(), { history: false })) as SignalGraph;
    expect(view.history).toBeUndefined();
    expect(view.nodes).toHaveLength(5);
    const big = JSON.parse(
      signalGraphText(bigGraph(400, 50), { node: 's10', history: false }),
    ) as SignalGraph;
    expect(big.history).toBeUndefined();
    expect(big.nodes.map((n) => n.label)).toEqual(['s9', 's10', 's11']);
  });
});

describe('inspect-signals tool', () => {
  it('passes `node` and `history` through and caps a large graph', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', { pageId: 'p1', ...bigGraph() });
    const capped = await call('inspect-signals', { selector: 'app-root' });
    expect(capped.length).toBeLessThanOrEqual(SIGNAL_TOOL_MAX);
    expect(capped).toMatch(/Cut to fit 20,000 characters/);
    const one = JSON.parse(
      await call('inspect-signals', { selector: 'app-root', node: 'n5', history: false }),
    ) as SignalGraph;
    expect(one.nodes.map((n) => n.id)).toEqual(['n4', 'n5', 'n6']);
    expect(one.history).toBeUndefined();
  });

  it('caps the graph it falls back to when the selector does not match', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', { pageId: 'p1', ...bigGraph() });
    const text = await call('inspect-signals', { selector: 'app-other' });
    expect(text).toMatch(/^No signal graph for `app-other`/);
    expect(text.length).toBeLessThanOrEqual(SIGNAL_TOOL_MAX);
    expect(text).toMatch(/Cut to fit/);
  });
});

describe('navigate answer', () => {
  it('leaves a short result whole', () => {
    const text = routerActionText({ ok: true });
    expect(text).toMatch(/```json\n\{\n {2}"ok": true\n\}\n```$/);
  });
});
