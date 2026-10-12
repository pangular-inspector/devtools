// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPONENT_TREE_SHAPE } from '../push-delta.ts';
import { createReportDeltas, deltaPush } from '../rpc/report-deltas.ts';

// Push size and frequency for a synthetic app of 2,000 components. Slow, so
// it runs only on demand:
//
//   PANGULAR_BENCH=1 pnpm vitest run --root packages/devtools src/__tests__/push-bench.test.ts
//
// PANGULAR_BENCH_SRC points at another copy of `packages/devtools/src` (an
// absolute path inside the workspace) to measure it the same way, such as the
// sources before a change.

const SRC = process.env['PANGULAR_BENCH_SRC'] || '..';
const COMPONENTS = 2000;

const calls: { name: string; bytes: number; at: number }[] = [];
const handlers = new Map<string, (message: unknown) => unknown>();
let watching = true;
const deltas = createReportDeltas(COMPONENT_TREE_SHAPE);
const store = deltaPush(
  deltas,
  () => true,
  () => true,
);

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    connectionMeta: {
      backend: 'websocket',
      configs: {
        pangular: {
          inspectors: {
            router: false,
            analog: false,
            signals: false,
            http: false,
            errors: false,
            forms: false,
            pipes: false,
            injectors: false,
          },
        },
      },
    },
    scope: () => ({
      rpc: {
        call: async (name: string, arg?: unknown) => {
          const json = JSON.stringify(arg ?? null);
          calls.push({ name, bytes: json.length, at: Date.now() });
          if (name === 'page-interest') return { watching };
          if (name.startsWith('ping-')) return { known: true };
          if (name === 'push-component-tree') return store(JSON.parse(json));
          return undefined;
        },
        register: (definition: { name: string; handler: (message: unknown) => unknown }) =>
          void handlers.set(definition.name, definition.handler),
      },
    }),
  }),
}));

let profiler: ((event: number) => void) | null = null;

function app() {
  const tags = new Map<string, object>();
  const instance = (tag: string) => {
    if (!tags.has(tag)) {
      const ctor = { [`Cmp${tag}`]: class {} }[`Cmp${tag}`]!;
      tags.set(tag, new ctor());
    }
    return tags.get(tag)!;
  };
  const root = document.createElement('app-root');
  root.setAttribute('ng-version', '22.0.0');
  // 40 sections of 49 rows with one cell each, plus the root: 2,000 components.
  for (let s = 0; s < 40; s++) {
    const section = document.createElement(`app-section`);
    for (let r = 0; r < 24; r++) {
      const row = document.createElement('app-row');
      row.append(document.createElement('app-cell'));
      section.append(row);
    }
    if (s < 39) section.append(document.createElement('app-row'));
    root.append(section);
  }
  document.body.replaceChildren(root);
  const count = document.querySelectorAll('app-root, app-section, app-row, app-cell').length;
  (window as unknown as { ng: unknown }).ng = {
    getComponent: (el: Element) =>
      el.tagName.startsWith('APP-') ? instance(el.tagName.toLowerCase()) : null,
    getDirectives: () => [],
    ɵsetProfiler: (fn: typeof profiler) => {
      profiler = fn;
      return () => (profiler = null);
    },
  };
  return count;
}

interface Run {
  pushes: number;
  pings: number;
  bytes: number;
  firstBytes: number;
  ms: number;
}

/** A busy app: change detection every 100 ms, an element added every `addEvery` ticks (0: never). */
async function busy(seconds: number, addEvery: number): Promise<Run> {
  const from = calls.length;
  const started = performance.now();
  for (let t = 0; t < seconds * 10; t++) {
    profiler?.(2);
    if (addEvery && t % addEvery === 0) {
      document.querySelector('app-section')!.append(document.createElement('app-row'));
    }
    await vi.advanceTimersByTimeAsync(100);
  }
  const window = calls.slice(from);
  const pushes = window.filter((c) => c.name === 'push-component-tree');
  return {
    pushes: pushes.length,
    pings: window.filter((c) => c.name === 'ping-component-tree').length,
    bytes: window
      .filter((c) => c.name.endsWith('component-tree'))
      .reduce((sum, c) => sum + c.bytes, 0),
    firstBytes: pushes[0]?.bytes ?? 0,
    ms: Math.round(performance.now() - started),
  };
}

describe.runIf(process.env['PANGULAR_BENCH'])('push benchmark', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('measures component tree pushes for a 2,000 component app', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    const count = app();
    expect(count).toBe(COMPONENTS);
    const { initOverlay } = (await import(/* @vite-ignore */ `${SRC}/overlay.ts`)) as {
      initOverlay: () => Promise<() => void>;
    };
    const start = performance.now();
    const pending = initOverlay();
    await vi.advanceTimersByTimeAsync(300);
    const stop = await pending;
    const first = calls.find((c) => c.name === 'push-component-tree');
    const startMs = Math.round(performance.now() - start);

    const steady = await busy(10, 0);
    const growing = await busy(10, 10);
    const churning = await busy(10, 1);
    watching = false;
    for (const handler of [handlers.get('page-interest-changed')]) handler?.({ watching: false });
    const idle = await busy(10, 1);
    stop();

    const result = {
      source: SRC,
      components: count,
      firstPushBytes: first?.bytes ?? 0,
      startMs,
      steady,
      growing,
      churning,
      idle,
    };
    console.info(`[bench] ${JSON.stringify(result, null, 2)}`);
    process.stdout.write(`[bench] ${JSON.stringify(result)}\n`);
    expect(first?.bytes ?? 0).toBeGreaterThan(0);
  }, 120_000);
});
