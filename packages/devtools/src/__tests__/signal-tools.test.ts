import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import { UNTRUSTED } from '../rpc/forms-tools.ts';
import { routerActionText } from '../rpc/router-tools.ts';
import { pageResourceText } from '../agent-page-resources.ts';
import {
  SIGNAL_TOOL_MAX,
  signalGraphText,
  signalStateForAgents,
  withIdEdges,
} from '../rpc/signal-tools.ts';
import type { SignalChange, SignalGraph } from '../types.ts';
import { answerText } from './tool-answer.ts';

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
    await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
  return { ctx, push, call };
}

const component = { id: 'c1', name: 'App', tag: 'app-root', path: 'app-root' };

/** A graph as agents read it: edges name node ids. */
type AgentGraph = Omit<SignalGraph, 'edges'> & { edges: { consumer: string; producer: string }[] };

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
  it('returns a small graph as plain JSON, with edges naming node ids', () => {
    const graph = smallGraph();
    expect(JSON.parse(signalGraphText(graph))).toEqual({
      ...graph,
      // doubled reads count, label reads doubled, logEffect reads count.
      edges: [
        { consumer: 'b', producer: 'a' },
        { consumer: 'c', producer: 'b' },
        { consumer: 'd', producer: 'a' },
      ],
    });
  });

  it('counts signals without a debugName so agents can suggest naming them', () => {
    const graph = smallGraph();
    graph.nodes.push(
      { id: 'u1', kind: 'signal', epoch: 0, value: 1 },
      { id: 'u2', kind: 'effect', epoch: 0 },
    );
    const view = JSON.parse(signalGraphText(graph)) as { unnamedSignals?: number };
    expect(view.unnamedSignals).toBe(1);
    expect(JSON.parse(signalGraphText(smallGraph()))).not.toHaveProperty('unnamedSignals');
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
    // What is kept still parses and its edges point at kept nodes, by id.
    const kept = JSON.parse(text.slice(0, text.lastIndexOf('\n\n_Cut'))) as AgentGraph;
    expect(kept.nodes.length).toBeGreaterThan(0);
    expect(kept.edges.length).toBe(kept.nodes.length - 1);
    const ids = new Set(kept.nodes.map((n) => n.id));
    for (const e of kept.edges) {
      expect(ids.has(e.consumer)).toBe(true);
      expect(ids.has(e.producer)).toBe(true);
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
    const view = JSON.parse(signalGraphText(smallGraph(), { node: 'doubled' })) as AgentGraph;
    expect(view.nodes.map((n) => n.label)).toEqual(['count', 'doubled', 'label']);
    expect(view.edges).toEqual([
      { consumer: 'b', producer: 'a' },
      { consumer: 'c', producer: 'b' },
    ]);
    expect(view.resources?.map((r) => r.id)).toEqual(['r2']);
    expect(Object.keys(view.history ?? {})).toEqual(['a', 'c']);
  });

  it('matches `node` by id, keeps only edges that touch it, and names nodes when none match', () => {
    const view = JSON.parse(signalGraphText(smallGraph(), { node: 'a' })) as AgentGraph;
    expect(view.nodes.map((n) => n.id)).toEqual(['a', 'b', 'd']);
    expect(view.edges).toEqual([
      { consumer: 'b', producer: 'a' },
      { consumer: 'd', producer: 'a' },
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

  it('keeps the note and no stray JSON when the budget is smaller than the note', () => {
    const text = signalGraphText(bigGraph(20, 50), {}, 300);
    expect(text).toMatch(/^_Cut to fit 300 characters/);
    expect(text).toContain('No part of the graph fits.');
    expect(text).toContain('Pass `node`');
    expect(text).not.toContain('"nodes"');
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

describe('signal edges for agents', () => {
  const ID_EDGES = [
    { consumer: 'b', producer: 'a' },
    { consumer: 'c', producer: 'b' },
    { consumer: 'd', producer: 'a' },
  ];

  it('name node ids, and drop an edge to a node that is not there', () => {
    const graph = smallGraph();
    graph.edges.push({ consumer: 9, producer: 0 });
    expect(withIdEdges(graph).edges).toEqual(ID_EDGES);
    // The panel's copy keeps positions.
    expect(graph.edges[0]).toEqual({ consumer: 1, producer: 0 });
  });

  it('name node ids in the signal-graph resources, global and per page', () => {
    const graph = smallGraph();
    const state = { graph, pages: { p1: graph } };
    const global = signalStateForAgents(state) as unknown as {
      graph: { edges: unknown };
      pages: Record<string, { edges: unknown }>;
    };
    expect(global.graph.edges).toEqual(ID_EDGES);
    expect(global.pages['p1']!.edges).toEqual(ID_EDGES);
    const page = JSON.parse(pageResourceText('signal-graph', state, 'p1')!);
    expect(page.graph.edges).toEqual(ID_EDGES);
    expect(page.pages.p1.edges).toEqual(ID_EDGES);
  });
});

describe('inspect-signals tool', () => {
  it('passes `node` and `history` through and caps a large graph', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', { pageId: 'p1', ...bigGraph() });
    const capped = await call('inspect-signals', { component: 'app-root' });
    // The notice counts toward the cap, so the graph gets what is left of it.
    expect(capped.startsWith(`${UNTRUSTED}\n\n`)).toBe(true);
    expect(capped.length).toBeLessThanOrEqual(SIGNAL_TOOL_MAX);
    expect(capped).toMatch(/Cut to fit 19,\d{3} characters/);
    const one = JSON.parse(
      (await call('inspect-signals', { component: 'app-root', node: 'n5', history: false })).slice(
        UNTRUSTED.length,
      ),
    ) as SignalGraph;
    expect(one.nodes.map((n) => n.id)).toEqual(['n4', 'n5', 'n6']);
    expect(one.history).toBeUndefined();
  });

  it('caps the graph it falls back to when the selector does not match', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', { pageId: 'p1', ...bigGraph() });
    const text = await call('inspect-signals', { component: 'app-other' });
    expect(text.startsWith(`${UNTRUSTED}\n\nNo signal graph for \`app-other\``)).toBe(true);
    expect(text.length).toBeLessThanOrEqual(SIGNAL_TOOL_MAX);
    expect(text).toMatch(/Cut to fit/);
  });
});

describe('inspect-signals tool with a long selector', () => {
  it('keeps the cut note when the selector it echoes is long', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', { pageId: 'p1', ...bigGraph() });
    const text = await call('inspect-signals', { component: 'x'.repeat(19_800) });
    expect(text.length).toBeLessThanOrEqual(SIGNAL_TOOL_MAX);
    // The answer starts with the untrusted-data notice, then the heading.
    expect(text).toMatch(/No signal graph for `x{200}…`/);
    expect(text).toMatch(/Cut to fit [\d,]+ characters/);
  });
});

describe('navigate answer', () => {
  it('leaves a short result whole', () => {
    const text = routerActionText({ ok: true });
    expect(text).toMatch(/```json\n\{\n {2}"ok": true\n\}\n```$/);
  });
});
