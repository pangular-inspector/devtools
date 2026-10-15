import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPangular } from '../devframe.ts';
import type { PangularConfig } from '../config.ts';
import type { ErrorsState } from '../rpc/errors-tools.ts';
import {
  WAIT_FOR_DESCRIPTION,
  createWaitForTool,
  waitTimeout,
  waitUntil,
} from '../rpc/wait-for.ts';
import type { ComponentPage, LiveComponentNode } from '../types.ts';

async function boot(config: PangularConfig = {}) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (args: Record<string, unknown>) =>
    ((await ctx.agent.invoke('pangular:wait-for', args)) as { markdown: string }).markdown;
  const tools = ctx.agent.list().tools.map((tool) => tool.id);
  return { push, call, tools, ctx };
}

const later = (ms: number, fn: () => unknown) =>
  new Promise<void>((resolve) =>
    setTimeout(async () => {
      await fn();
      resolve();
    }, ms),
  );

const node = (id: string, name: string, tag: string, children: LiveComponentNode[] = []) => ({
  id,
  name,
  tag,
  children,
});
const tree = (pageId: string, children: LiveComponentNode[] = []) => ({
  pageId,
  roots: [node('c1', 'App', 'app-root', children)],
  count: 1 + children.length,
  detail: null,
});

const snapshot = (url: string, pending?: { id: number; url: string }) => ({
  url,
  queryParams: {},
  fragment: null,
  root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
  ...(pending ? { pending } : {}),
});
const router = (pageId: string, url: string, navigations: unknown[], pending?: string) => ({
  pageId,
  generation: 1,
  snapshot: snapshot(url, pending ? { id: 2, url: pending } : undefined),
  navigations,
});
const nav = (id: number, url: string, outcome: string) => ({
  id,
  url,
  trigger: 'imperative',
  startedAt: 1000 + id,
  ...(outcome === 'pending' ? {} : { endedAt: 1010 + id }),
  outcome,
});

const httpCall = (id: string, url: string, status = 200) => ({
  id,
  url,
  method: 'GET',
  status,
  durationMs: 12,
  side: 'client',
  cacheHit: false,
  faulted: false,
  at: Date.now(),
});
const http = (pageId: string, calls: unknown[]) => ({
  pageId,
  url: 'http://localhost:4200/',
  payload: { entries: [] },
  full: true,
  calls,
});

const errors = (pageId: string, count: number, code?: string) => ({
  pageId,
  full: true,
  url: '/trips',
  title: 'Trips',
  handler: 'wrapped',
  errors: count
    ? [
        {
          id: 'e1',
          message: 'TypeError: trips is undefined',
          ...(code ? { code } : {}),
          count,
          firstAt: Date.now(),
          lastAt: Date.now(),
          sources: ['handler'],
          owner: { id: 'c1', name: 'TripList' },
        },
      ]
    : [],
  console: [],
  dropped: { errors: 0, console: 0 },
});

afterEach(() => {
  vi.useRealTimers();
});

describe('wait-for agent tool', () => {
  it('keeps its description short and registers as a read tool with its inspectors as tags', async () => {
    expect(WAIT_FOR_DESCRIPTION.length).toBeLessThanOrEqual(600);
    const { ctx } = await boot();
    const tool = ctx.agent.list().tools.find((t) => t.id === 'pangular:wait-for');
    expect(tool?.safety).toBe('read');
    expect(tool?.tags).toEqual(['components', 'router', 'http', 'errors']);
  });

  it('component: answers at once when a match is rendered, and waits for one that appears', async () => {
    const { push, call } = await boot();
    await push('push-component-tree', tree('p1', [node('c2', 'Card', 'app-card')]));
    expect(await call({ condition: 'component', selector: 'Card' })).toMatch(
      /^Condition `component` `Card` holds after \d+ms\. `Card` matches `Card` \(`<app-card>`, instance `c2` on page `p1`\)\./,
    );

    const waiting = call({ condition: 'component', selector: 'app-dialog', timeoutMs: 3000 });
    await later(50, () =>
      push('push-component-tree', tree('p1', [node('c3', 'Dialog', 'app-dialog')])),
    );
    expect(await waiting).toContain('instance `c3` on page `p1`');
  });

  it('component-gone: holds once no instance matches', async () => {
    const { push, call } = await boot();
    await push('push-component-tree', tree('p1', [node('c2', 'Spinner', 'app-spinner')]));
    const waiting = call({ condition: 'component-gone', selector: 'Spinner', timeoutMs: 3000 });
    await later(50, () => push('push-component-tree', tree('p1')));
    expect(await waiting).toMatch(
      /^Condition `component-gone` `Spinner` holds after \d+ms\. No component matches `Spinner`\./,
    );
  });

  it('navigation: waits for the pending navigation to end at a matching URL', async () => {
    const { push, call } = await boot();
    await push('push-router', router('p1', '/', [nav(1, '/products', 'pending')], '/products'));
    const waiting = call({ condition: 'navigation', url: '/products', timeoutMs: 3000 });
    await later(50, () =>
      push('push-router', router('p1', '/products', [nav(1, '/products', 'succeeded')])),
    );
    const text = await waiting;
    expect(text).toContain('Condition `navigation` to `/products` holds');
    expect(text).toContain('Page `p1` is at `/products`, with no navigation in progress');
  });

  it('navigation: without url, holds when nothing is in progress', async () => {
    const { push, call } = await boot();
    await push('push-router', router('p1', '/home', [nav(1, '/home', 'succeeded')]));
    expect(await call({ condition: 'navigation' })).toContain('Condition `navigation` holds');
  });

  it('http-call: ignores calls made before the wait and holds on a new matching one', async () => {
    const { push, call } = await boot();
    await push('push-http', http('p1', [httpCall('a1', '/api/cart')]));
    const waiting = call({ condition: 'http-call', url: '/api/cart', timeoutMs: 3000 });
    await later(30, () =>
      push('push-http', http('p1', [httpCall('a1', '/api/cart'), httpCall('a2', '/api/user')])),
    );
    await later(30, () =>
      push(
        'push-http',
        http('p1', [
          httpCall('a1', '/api/cart'),
          httpCall('a2', '/api/user'),
          httpCall('a3', '/api/cart', 201),
        ]),
      ),
    );
    const text = await waiting;
    expect(text).toContain('Condition `http-call` `/api/cart` holds');
    expect(text).toContain('GET `/api/cart` on page `p1` finished: 201 in 12ms');
  });

  it('error: holds on a new occurrence after the wait started, filtered by code', async () => {
    const { push, call } = await boot();
    await push('push-errors', errors('p1', 1));
    const any = call({ condition: 'error', timeoutMs: 3000 });
    await later(30, () => push('push-errors', errors('p1', 2)));
    const text = await any;
    expect(text).toContain('Condition `error` holds');
    expect(text).toContain('Error `e1` on page `p1` in `TripList` (instance `c1`)');
    expect(text).toContain('`TypeError: trips is undefined`');

    // An error with another code doesn't satisfy a wait for NG0100; one with it does.
    const other = call({ condition: 'error', code: 'ng0100', timeoutMs: 200 });
    await later(30, () => push('push-errors', errors('p1', 3, 'NG0200')));
    expect(await other).toContain(
      'Timed out after 200ms waiting for `error` `ng0100`. Last state: No new error with code `NG0100` since the wait started.',
    );
    const coded = call({ condition: 'error', code: 'ng0100', timeoutMs: 3000 });
    await later(30, () => push('push-errors', errors('p1', 4, 'NG0100')));
    expect(await coded).toContain('Error `e1` on page `p1` (NG0100)');
  });

  it('times out with the last state instead of throwing', async () => {
    const { push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    const started = Date.now();
    expect(await call({ condition: 'component', selector: 'Missing', timeoutMs: 150 })).toBe(
      'Timed out after 150ms waiting for `component` `Missing`. Last state: No component matches `Missing`.',
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(140);

    await push('push-http', http('p1', []));
    expect(await call({ condition: 'http-call', timeoutMs: 120 })).toContain(
      'Last state: No HttpClient call finished since the wait started.',
    );
  });

  it('validates its arguments', async () => {
    const { push, call } = await boot();
    expect(await call({})).toMatch(/^Pass `condition`: `component`, `component-gone`/);
    expect(await call({ condition: 'stable' })).toMatch(/^Pass `condition`/);
    await push('push-component-tree', tree('p1'));
    expect(await call({ condition: 'component' })).toMatch(/^Pass `selector`/);
    expect(await call({ condition: 'component', selector: '   ' })).toMatch(/^Pass `selector`/);
    expect(await call({ condition: 'component', selector: 'App', page: 'nope' })).toContain(
      'No page `nope` is reporting a component tree',
    );
    expect(await call({ condition: 'component', selector: 'App', pageId: 'p1' })).toContain(
      'holds',
    );
    expect(await call({ condition: 'navigation' })).toMatch(
      /^No page reports the router right now/,
    );
  });

  it('offers only the conditions whose inspector is on, and is left out when none is', async () => {
    const some = await boot({ inspectors: { components: false, http: false } });
    expect(some.tools).toContain('pangular:wait-for');
    expect(await some.call({ condition: 'component', selector: 'App' })).toBe(
      "`component` needs the Components inspector, which is turned off for agents in this server's config.",
    );
    expect(await some.call({})).toBe('Pass `condition`: `navigation`, `error`.');

    const none = await boot({
      inspectors: { components: false, router: false, http: false, errors: false },
    });
    expect(none.tools).not.toContain('pangular:wait-for');
  });
});

describe('waitUntil', () => {
  it('resolves on a change event and removes its timers and listeners', async () => {
    vi.useFakeTimers();
    let ready = false;
    const listeners = new Set<() => void>();
    const keepAlive = vi.fn();
    const waiting = waitUntil(() => ready, {
      timeoutMs: 10_000,
      pollMs: 5000,
      keepAliveMs: 1000,
      keepAlive,
      subscribe: [
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      ],
    });
    expect(listeners.size).toBe(1);
    expect(vi.getTimerCount()).toBe(3);
    await vi.advanceTimersByTimeAsync(2500);
    expect(keepAlive).toHaveBeenCalledTimes(2);
    ready = true;
    for (const listener of listeners) listener();
    expect(await waiting).toBe(true);
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves false on timeout and cleans up, treating a throwing check as not met', async () => {
    vi.useFakeTimers();
    const off = vi.fn();
    const waiting = waitUntil(
      () => {
        throw new Error('boom');
      },
      { timeoutMs: 300, pollMs: 100, subscribe: [() => off] },
    );
    await vi.advanceTimersByTimeAsync(300);
    expect(await waiting).toBe(false);
    expect(off).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers at once without timers when the condition already holds', async () => {
    vi.useFakeTimers();
    const subscribe = vi.fn();
    expect(await waitUntil(() => true, { timeoutMs: 1000, subscribe: [subscribe] })).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('picks up a change by polling when no store sends events', async () => {
    vi.useFakeTimers();
    let ready = false;
    const waiting = waitUntil(() => ready, { timeoutMs: 1000, pollMs: 100 });
    ready = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(await waiting).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('createWaitForTool', () => {
  it('cleans up its listeners when the tool answers', async () => {
    vi.useFakeTimers();
    const pages = new Map<string, ComponentPage>();
    const listeners = new Set<() => void>();
    const tool = createWaitForTool({
      components: () => pages.values(),
      errors: () => ({ pages: {} }) as ErrorsState,
      subscribe: [
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      ],
    })!;
    pages.set('p1', { ...tree('p1'), reportedAt: Date.now() } as ComponentPage);
    const answer = tool.handler({ condition: 'component', selector: 'Card' });
    await vi.advanceTimersByTimeAsync(0);
    expect(listeners.size).toBe(1);
    pages.set('p1', {
      ...tree('p1', [node('c2', 'Card', 'app-card')]),
      reportedAt: Date.now(),
    } as ComponentPage);
    for (const listener of listeners) listener();
    expect((await answer).markdown).toContain('holds');
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(tool.inputSchema.properties.condition.enum).toEqual([
      'component',
      'component-gone',
      'error',
    ]);
  });

  it('clamps timeoutMs between 100 and 30000, with 5000 by default', () => {
    expect(waitTimeout(undefined)).toBe(5000);
    expect(waitTimeout('abc')).toBe(5000);
    expect(waitTimeout(-5)).toBe(5000);
    expect(waitTimeout(10)).toBe(100);
    expect(waitTimeout(2500)).toBe(2500);
    expect(waitTimeout(120_000)).toBe(30_000);
  });

  it('is undefined without any source', () => {
    expect(createWaitForTool({})).toBeUndefined();
  });
});
