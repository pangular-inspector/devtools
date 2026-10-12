// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSignalGraph, type SignalDebugNg } from '../signal-graph.ts';
import { FRAMEWORK_SIGNAL_NAMES, frameworkNodes } from '../signal-framework.ts';
import type { SignalGraphEdge, SignalGraphNode } from '../types.ts';

const require = createRequire(import.meta.url);

function angularDebugNames(): Set<string> {
  const names = new Set<string>();
  for (const pkg of ['router', 'forms', 'common']) {
    const dir = join(dirname(require.resolve(`@angular/${pkg}/package.json`)), 'fesm2022');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
      const text = readFileSync(join(dir, file), 'utf-8');
      for (const match of text.matchAll(/debugName: *['"]([^'"]+)['"]/g)) names.add(match[1]!);
    }
  }
  return names;
}

function node(
  id: string,
  kind: SignalGraphNode['kind'],
  label?: string,
  epoch = 0,
): SignalGraphNode {
  return label === undefined ? { id, kind, epoch } : { id, kind, label, epoch };
}

/** Edge from producer to consumer, by index. */
const reads = (consumer: number, producer: number): SignalGraphEdge => ({ consumer, producer });

describe('FRAMEWORK_SIGNAL_NAMES', () => {
  it('only lists debug names the installed Angular packages give their own signals', () => {
    const names = angularDebugNames();
    const unknown = [...FRAMEWORK_SIGNAL_NAMES].filter((name) => !names.has(name));
    expect(unknown).toEqual([]);
  });
});

describe('frameworkNodes', () => {
  it('marks a named framework computed and the unnamed inputs only it reads', () => {
    const nodes = [
      node('t', 'template', 'app-root'),
      node('h', 'computed', 'reactiveHref'),
      node('u', 'computed', '_urlTree'),
      node('x', 'signal'),
    ];
    const edges = [reads(0, 1), reads(1, 2), reads(2, 3)];
    expect([...frameworkNodes(nodes, edges)].sort()).toEqual([1, 2, 3]);
  });

  it('keeps an app signal with a framework-like name that the template reads', () => {
    const nodes = [node('t', 'template', 'app-root'), node('s', 'signal', 'status')];
    expect(frameworkNodes(nodes, [reads(0, 1)]).size).toBe(0);
  });

  it('keeps an unnamed signal that an app computed reads too', () => {
    const nodes = [
      node('t', 'template', 'app-root'),
      node('v', 'computed', 'valid'),
      node('total', 'computed', 'total'),
      node('x', 'signal'),
    ];
    const edges = [reads(0, 1), reads(0, 2), reads(1, 3), reads(2, 3)];
    expect([...frameworkNodes(nodes, edges)]).toEqual([1]);
  });

  it("never marks the component's own fields, templates or resource internals", () => {
    const nodes = [
      node('t', 'template', 'status'),
      node('s', 'computed', 'status', 3),
      node('r', 'computed', 'errors'),
      node('e', 'effect'),
    ];
    const own = [{ label: 'status', kind: 'computed', epoch: 3 }];
    expect(frameworkNodes(nodes, [reads(0, 1), reads(0, 2)], own, new Set(['r'])).size).toBe(0);
  });

  it('marks framework effects by name but not unnamed ones', () => {
    const nodes = [node('a', 'effect', 'blockingEffect'), node('b', 'effect')];
    expect([...frameworkNodes(nodes, [])]).toEqual([0]);
  });
});

describe('collectSignalGraph framework flag', () => {
  const SIGNAL = Symbol('SIGNAL');
  const field = (raw: object) => Object.assign(() => undefined, { [SIGNAL]: raw });

  it('flags framework nodes and spares a component field with the same name', () => {
    document.body.innerHTML = '<app-root ng-version="22.0.0"></app-root>';
    const instance = { status: field({ kind: 'computed', debugName: 'status', version: 4 }) };
    const ng: SignalDebugNg = {
      getComponent: (el) => (el.tagName === 'APP-ROOT' ? instance : null),
      getInjector: (el) => el,
      isSignal: (v) => typeof v === 'function' && SIGNAL in (v as object),
      ɵgetSignalGraph: () => ({
        nodes: [
          { id: '1', kind: 'template', label: 'app-root', epoch: 1 },
          { id: '2', kind: 'computed', label: 'reactiveHref', epoch: 1, value: '/a' },
          { id: '3', kind: 'computed', label: 'status', epoch: 4, value: 'ok' },
        ],
        edges: [reads(0, 1), reads(0, 2)],
      }),
    };
    const graph = collectSignalGraph(ng)!;
    expect(graph.nodes.map((n) => [n.label, n.framework ?? false])).toEqual([
      ['app-root', false],
      ['reactiveHref', true],
      ['status', false],
    ]);
  });
});
