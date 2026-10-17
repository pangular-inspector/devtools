// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFER_BLOCK_ATTRIBUTE, watchDeferHydration } from '../defer-hydration-watch.ts';
import { attachHttp, createHydrationScanner } from '../http-overlay.ts';
import { httpRegistry } from '../http-rules.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** What Angular leaves on an element of a dehydrated `@defer (hydrate on interaction)` block. */
function dehydratedBlock(id: string, count = 2): HTMLElement[] {
  const elements: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('button');
    el.setAttribute('jsaction', 'click:;');
    el.setAttribute(DEFER_BLOCK_ATTRIBUTE, id);
    document.body.append(el);
    elements.push(el);
  }
  return elements;
}

/** What `removeListeners` in @angular/core does once the block hydrated. */
function hydrate(elements: HTMLElement[]) {
  for (const el of elements) {
    el.removeAttribute('jsaction');
    el.removeAttribute(DEFER_BLOCK_ATTRIBUTE);
  }
}

describe('watchDeferHydration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fires once per hydrated batch, not when blocks are added', async () => {
    const onHydrate = vi.fn();
    const watch = watchDeferHydration(onHydrate);
    const block = dehydratedBlock('d0');
    await flush();
    expect(onHydrate).not.toHaveBeenCalled();
    expect(watch.epoch()).toBe(0);
    hydrate(block);
    await flush();
    expect(onHydrate).toHaveBeenCalledTimes(1);
    expect(watch.epoch()).toBe(1);
    watch.stop();
  });

  it('counts a hydration whose records were not delivered yet', () => {
    const block = dehydratedBlock('d1', 1);
    const watch = watchDeferHydration(() => {});
    hydrate(block);
    expect(watch.epoch()).toBe(1);
    watch.stop();
  });

  it('ignores other attributes and stops observing on stop()', async () => {
    const onHydrate = vi.fn();
    const block = dehydratedBlock('d2', 1);
    const watch = watchDeferHydration(onHydrate);
    block[0].removeAttribute('jsaction');
    block[0].setAttribute('class', 'x');
    await flush();
    expect(onHydrate).not.toHaveBeenCalled();
    watch.stop();
    hydrate(block);
    await flush();
    expect(onHydrate).not.toHaveBeenCalled();
    expect(watch.epoch()).toBe(0);
  });

  it('writes nothing to the page', async () => {
    const block = dehydratedBlock('d3');
    const before = document.body.innerHTML;
    const watch = watchDeferHydration(() => {});
    await flush();
    expect(document.body.innerHTML).toBe(before);
    hydrate(block);
    watch.stop();
  });
});

describe('hydration scanner and defer hydration', () => {
  it('rescans when a defer block hydrated, even with unchanged counters', () => {
    let calls = 0;
    const scanner = createHydrationScanner(() => {
      calls++;
      return { hydrated: 0, skipped: 0, mismatched: 0, mismatches: [] };
    });
    const counters = { hydratedNodes: 3 };
    for (let i = 0; i < 10; i++) scanner(counters, 1000, 0);
    expect(calls).toBe(3);
    scanner(counters, 1000, 1);
    expect(calls).toBe(4);
    scanner(counters, 1000, 1);
    expect(calls).toBe(4);
    // Same for the time bucket used without counters.
    for (let i = 0; i < 3; i++) scanner(undefined, 1000, 1);
    const before = calls;
    scanner(undefined, 1000, 2);
    expect(calls).toBe(before + 1);
  });
});

describe('attachHttp and @defer (hydrate)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    httpRegistry().calls = [];
  });

  it('pushes the new hydration count when a block hydrates, without a refresh', async () => {
    const devMode = globalThis as { ngDevMode?: unknown };
    const previous = devMode.ngDevMode;
    // Plain `true`: no counters, so only the time bucket or the watch can move the scan.
    devMode.ngDevMode = true;
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const sent: { hydration: { nodes: { hydrated: number } } }[] = [];
    const my = {
      rpc: {
        call: async (name: string, report?: unknown) => {
          if (name === 'push-http') sent.push(report as (typeof sent)[number]);
          if (name === 'get-http-rules') return [];
          return name === 'push-http' ? { needPayload: false } : { known: true };
        },
        register: () => {},
      },
    };
    const block = dehydratedBlock('d0', 2);
    const http = attachHttp(my, 'p1');
    try {
      // Fill the scanner's warm-up so later pushes reuse the cached scan.
      for (let i = 0; i < 4; i++) await http.push();
      expect(sent[0].hydration.nodes.hydrated).toBe(0);
      const sentBefore = sent.length;
      for (const el of block) {
        (el as unknown as Record<string, unknown>)['__ngDebugHydrationInfo__'] = {
          status: 'hydrated',
        };
      }
      hydrate(block);
      await flush();
      await flush();
      expect(sent.length).toBeGreaterThan(sentBefore);
      expect(sent.at(-1)!.hydration.nodes.hydrated).toBe(2);
    } finally {
      http.stop();
      vi.restoreAllMocks();
      devMode.ngDevMode = previous;
    }
  });
});
