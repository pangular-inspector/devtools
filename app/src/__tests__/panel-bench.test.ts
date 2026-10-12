import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { describe, expect, it } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

// How long the component tree takes to render 2,000 instances, and how many
// rows it puts in the DOM. Slow, so it runs only on demand:
//
//   PANGULAR_BENCH=1 pnpm vitest run --config app/vitest.config.ts app/src/__tests__/panel-bench.test.ts

const COUNT = 2000;

/** Node's process, which the panel's types leave out. */
const node = (
  globalThis as {
    process?: { env: Record<string, string | undefined>; stdout: { write(text: string): void } };
  }
).process;

function roots() {
  const sections = Array.from({ length: 40 }, (_, s) => ({
    id: `s${s}`,
    name: 'Section',
    tag: 'app-section',
    children: [
      ...Array.from({ length: 24 }, (_, r) => ({
        id: `s${s}r${r}`,
        name: 'Row',
        tag: 'app-row',
        children: [{ id: `s${s}r${r}c`, name: 'Cell', tag: 'app-cell', children: [] as unknown[] }],
      })),
      // One more row in all but the last section: 2,000 instances in all.
      ...(s < 39 ? [{ id: `s${s}x`, name: 'Row', tag: 'app-row', children: [] }] : []),
    ],
  }));
  return [{ id: 'app', name: 'App', tag: 'app-root', children: sections }];
}

function client(tree: unknown[]): DevframeRpcClient {
  const state: Record<string, unknown> = {
    'component-tree': {
      pages: {
        a: {
          pageId: 'a',
          title: 'a',
          url: '/',
          roots: tree,
          count: COUNT,
          detail: null,
          reportedAt: 1,
        },
      },
    },
  };
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => state[name] ?? null, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

describe.runIf(node?.env['PANGULAR_BENCH'])('panel benchmark', () => {
  it('renders a 2,000 component tree', async () => {
    const tree = roots();
    const runs: number[] = [];
    let rows = 0;
    let nodes = 0;
    for (let i = 0; i < 5; i++) {
      const started = performance.now();
      const fixture = TestBed.createComponent(ComponentTree);
      fixture.componentRef.setInput('rpc', client(tree));
      document.body.appendChild(fixture.nativeElement);
      for (let k = 0; k < 4; k++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
      runs.push(performance.now() - started);
      const host = fixture.nativeElement as HTMLElement;
      rows = host.querySelectorAll('.row').length;
      nodes = host.querySelectorAll('*').length;
      fixture.destroy();
    }
    runs.sort((a, b) => a - b);
    const result = { rows, domNodes: nodes, medianRenderMs: Math.round(runs[2]!) };
    node?.stdout.write(`[bench] ${JSON.stringify(result)}\n`);
    expect(rows).toBeGreaterThan(0);
  }, 120_000);
});
