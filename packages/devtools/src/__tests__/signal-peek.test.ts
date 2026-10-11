// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectSignalGraph, type SignalDebugNg, type SignalTarget } from '../signal-graph.ts';
import { createSignalHistory } from '../signal-history.ts';
import { PEEK_EVENT, PEEK_RESULT, registerSignalPeek, toPeekRequest } from '../signal-peek.ts';
import { createSignalPeeks } from '../rpc/signal-peeks.ts';

class Root {}
class Page {}

const platform = { scopes: new Set(['platform']) };
const root = { scopes: new Set(['environment', 'root']) };
const environment = new Set<object>([platform, root]);

/** A fake `ng` with one routed component and effects in the root injector. */
function fakeNg(): SignalDebugNg {
  const components: Record<string, object> = { 'APP-ROOT': new Root(), 'APP-PAGE': new Page() };
  return {
    getComponent: (el) => components[el.tagName] ?? null,
    getInjector: (el) => el,
    ɵgetSignalGraph: (injector) =>
      injector === (root as unknown)
        ? {
            nodes: [
              { id: '10', kind: 'effect', label: 'persistTrips', epoch: 2 },
              { id: '11', kind: 'signal', label: 'trips', epoch: 2, value: 3 },
            ],
            edges: [{ consumer: 0, producer: 1 }],
          }
        : {
            nodes: [
              {
                id: '1',
                kind: 'signal',
                label: (injector as Element).tagName.toLowerCase(),
                epoch: 1,
                value: 1,
              },
            ],
            edges: [],
          },
    ɵgetInjectorResolutionPath: (injector) => [injector, root, platform],
    ɵgetInjectorMetadata: (injector) =>
      environment.has(injector as object)
        ? { type: 'environment', source: null }
        : { type: 'element', source: injector },
  };
}

function fakeRpc() {
  const handlers = new Map<string, (request: unknown) => void>();
  const calls: [string, unknown][] = [];
  return {
    handlers,
    calls,
    rpc: {
      register: (fn: { name: string; handler: (request: unknown) => void }) =>
        handlers.set(fn.name, fn.handler),
      call: async (name: string, arg: unknown) => {
        calls.push([name, arg]);
      },
    },
  };
}

const page = `
  <app-root ng-version="22.0.0">
    <router-outlet></router-outlet><app-page></app-page>
  </app-root>`;

describe('registerSignalPeek', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('answers with the root graph and leaves the selected target alone', async () => {
    document.body.innerHTML = page;
    const ng = fakeNg();
    const session = fakeRpc();
    const history = createSignalHistory((value) => value);
    const collect = vi.fn((wanted: SignalTarget) => collectSignalGraph(ng, wanted));
    registerSignalPeek(session.rpc, 'p1', collect, history);

    session.handlers.get(PEEK_EVENT)!({ requestId: 'peek1', env: 'root' });
    await Promise.resolve();

    // Only the injector was read; nothing re-targets the page's own graph.
    expect(collect.mock.calls).toEqual([[{ env: 'root' }]]);
    expect(session.handlers.has('select-signal-component')).toBe(false);
    const [name, answer] = session.calls[0]!;
    expect(name).toBe(PEEK_RESULT);
    expect(answer).toMatchObject({
      requestId: 'peek1',
      pageId: 'p1',
      graph: {
        pageId: 'p1',
        injector: { name: 'Root' },
        nodes: [{ label: 'persistTrips' }, { label: 'trips' }],
        history: { '11': [{ epoch: 2, value: 3, source: 'initial' }] },
      },
    });
  });

  it('answers null instead of the fallback component graph when no injector matches', async () => {
    document.body.innerHTML = page;
    const session = fakeRpc();
    registerSignalPeek(session.rpc, 'p1', (wanted) => collectSignalGraph(fakeNg(), wanted));
    session.handlers.get(PEEK_EVENT)!({ requestId: 'peek2', env: '/nope' });
    await Promise.resolve();
    expect(session.calls).toEqual([
      [PEEK_RESULT, { requestId: 'peek2', pageId: 'p1', graph: null }],
    ]);
  });

  it('ignores requests for another page and malformed requests', async () => {
    document.body.innerHTML = page;
    const session = fakeRpc();
    registerSignalPeek(session.rpc, 'p1', (wanted) => collectSignalGraph(fakeNg(), wanted));
    session.handlers.get(PEEK_EVENT)!({ requestId: 'peek3', env: 'root', pageId: 'p2' });
    session.handlers.get(PEEK_EVENT)!({ env: 'root' });
    session.handlers.get(PEEK_EVENT)!(null);
    await Promise.resolve();
    expect(session.calls).toEqual([]);
    expect(toPeekRequest({ requestId: 'r', env: 'root', pageId: 'p1' }, 'p1')).toEqual({
      requestId: 'r',
      env: 'root',
    });
  });
});

describe('createSignalPeeks', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves with the first graph from the asked page and ignores other pages', async () => {
    const peeks = createSignalPeeks();
    const sent: { requestId: string; env: string; pageId?: string }[] = [];
    const answer = peeks.request((message) => sent.push(message), 'root', 'p1', ['p1'], 1000);
    const { requestId } = sent[0]!;
    expect(sent[0]).toEqual({ requestId, env: 'root', pageId: 'p1' });
    peeks.answer({ requestId, pageId: 'p2', graph: { nodes: [], edges: [] } });
    peeks.answer({ requestId, pageId: 'p1', graph: { nodes: [{ id: 'e' }], edges: [] } });
    expect(await answer).toMatchObject({ pageId: 'p1', nodes: [{ id: 'e' }] });
  });

  it('resolves null once every asked page answered without a graph', async () => {
    const peeks = createSignalPeeks();
    let requestId = '';
    const answer = peeks.request(
      (m) => (requestId = m.requestId),
      'root',
      undefined,
      ['p1', 'p2'],
      60_000,
    );
    peeks.answer({ requestId, pageId: 'p1', graph: null });
    peeks.answer({ requestId, pageId: 'p1', graph: null });
    peeks.answer({ requestId, pageId: 'p2', graph: null });
    expect(await answer).toBeNull();
  });

  it('does not count an empty answer from a page that was not expected', async () => {
    const peeks = createSignalPeeks();
    let requestId = '';
    let settled = false;
    const answer = peeks.request(
      (m) => (requestId = m.requestId),
      'root',
      undefined,
      ['p1', 'p2'],
      60_000,
    );
    void answer.then(() => (settled = true));
    peeks.answer({ requestId, pageId: 'p3', graph: null });
    peeks.answer({ requestId, pageId: 'p2', graph: null });
    await Promise.resolve();
    expect(settled).toBe(false);
    peeks.answer({ requestId, pageId: 'p1', graph: { nodes: [{ id: 'e' }], edges: [] } });
    expect(await answer).toMatchObject({ pageId: 'p1', nodes: [{ id: 'e' }] });
  });

  it('resolves null when no page answers in time', async () => {
    vi.useFakeTimers();
    const peeks = createSignalPeeks();
    const answer = peeks.request(() => {}, 'root', undefined, ['p1'], 1500);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await answer).toBeNull();
  });
});
