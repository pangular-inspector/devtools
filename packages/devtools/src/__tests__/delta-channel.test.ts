// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeltaChannel } from '../delta-channel.ts';
import { createDomDirty } from '../dom-dirty.ts';
import { domTree } from '../host-tree.ts';
import { createPageLease, throttle } from '../page-lease.ts';
import { COMPONENT_TREE_SHAPE } from '../push-delta.ts';
import { createReportDeltas, deltaPush } from '../rpc/report-deltas.ts';

/** A server with the delta receiver in front of a store, as `devframe.ts` wires it. */
function server() {
  const stored: Record<string, unknown>[] = [];
  const deltas = createReportDeltas(COMPONENT_TREE_SHAPE);
  const handler = deltaPush(
    deltas,
    () => true,
    (report) => {
      stored.push(report);
      return true;
    },
  );
  const calls: { name: string; arg: unknown }[] = [];
  let known = true;
  const call = vi.fn(async (name: string, arg?: unknown) => {
    calls.push({ name, arg: JSON.parse(JSON.stringify(arg)) });
    if (name === 'ping-component-tree') return { known };
    return handler(JSON.parse(JSON.stringify(arg)));
  });
  return { stored, deltas, call, calls, forget: () => (known = false) };
}

const tree = (count: number) => ({
  roots: [{ id: 'a', name: 'App', tag: 'app-root', children: [] }],
  count,
  detail: null,
});

describe('delta channel', () => {
  afterEach(() => vi.useRealTimers());

  it('sends the report once in full, then only what changed', async () => {
    const { stored, call, calls } = server();
    const channel = createDeltaChannel({
      call,
      pageId: 'p1',
      push: 'push-component-tree',
      ping: 'ping-component-tree',
      shape: COMPONENT_TREE_SHAPE,
    });
    await channel.send(tree(1));
    await channel.send(tree(2));
    expect(calls[0]!.arg).toMatchObject({ roots: [{ id: 'a' }], delta: { full: true } });
    expect(calls[1]!.arg).toEqual({ pageId: 'p1', delta: { base: 1, seq: 2, set: { count: 2 } } });
    expect(stored.at(-1)).toEqual({ ...tree(2), pageId: 'p1' });
  });

  it('skips an unchanged report and pings when a keepalive is due', async () => {
    let now = 0;
    const { call, calls, forget, stored } = server();
    const channel = createDeltaChannel({
      call,
      pageId: 'p1',
      push: 'push-component-tree',
      ping: 'ping-component-tree',
      shape: COMPONENT_TREE_SHAPE,
      now: () => now,
    });
    await channel.send(tree(1));
    await channel.send(tree(1));
    expect(calls).toHaveLength(1);
    now = 9000;
    await channel.send(tree(1));
    expect(calls.map((c) => c.name)).toEqual(['push-component-tree', 'ping-component-tree']);
    // A server that forgot the page gets the whole report again.
    forget();
    now = 18_000;
    await channel.send(tree(1));
    expect(calls.at(-1)!.arg).toMatchObject({ delta: { full: true } });
    expect(stored).toHaveLength(2);
  });

  it('resends in full when the server lost track of the deltas', async () => {
    const { call, calls, deltas } = server();
    const channel = createDeltaChannel({
      call,
      pageId: 'p1',
      push: 'push-component-tree',
      shape: COMPONENT_TREE_SHAPE,
    });
    await channel.send(tree(1));
    deltas.forget('p1');
    await channel.send(tree(2));
    expect(calls.map((c) => (c.arg as { delta: { full?: boolean } }).delta.full ?? false)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('sends the whole report after a failed push', async () => {
    const { call, calls } = server();
    const channel = createDeltaChannel({
      call,
      pageId: 'p1',
      push: 'push-component-tree',
      shape: COMPONENT_TREE_SHAPE,
    });
    await channel.send(tree(1));
    call.mockRejectedValueOnce(new Error('socket closed'));
    await expect(channel.send(tree(2))).rejects.toThrow('socket closed');
    await channel.send(tree(2));
    expect(calls.at(-1)!.arg).toMatchObject({ count: 2, delta: { full: true } });
  });

  it('keeps sending full reports to a server that takes no deltas', async () => {
    const calls: unknown[] = [];
    const channel = createDeltaChannel({
      call: async (_name, arg) => void calls.push(arg),
      pageId: 'p1',
      push: 'push-component-tree',
      shape: COMPONENT_TREE_SHAPE,
    });
    await channel.send(tree(1));
    await channel.send(tree(1));
    await channel.send(tree(2));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ count: 2, roots: [{ id: 'a' }] });
  });
});

describe('page lease', () => {
  function rpc(watching: boolean | undefined) {
    const handlers = new Map<string, (message: unknown) => unknown>();
    const calls: { name: string; arg: unknown }[] = [];
    return {
      calls,
      emit: (name: string, message: unknown) => handlers.get(name)?.(message),
      my: {
        rpc: {
          call: async (name: string, arg?: unknown) => {
            calls.push({ name, arg });
            return name === 'page-interest' ? { watching } : undefined;
          },
          register: (definition: { name: string; handler: (message: unknown) => unknown }) =>
            void handlers.set(definition.name, definition.handler),
        },
      },
    };
  }

  it('stays active against a server without the lease', async () => {
    const { my } = rpc(undefined);
    const lease = createPageLease(my, 'p1', { wake: async () => {} });
    await lease.refresh();
    expect(lease.active).toBe(true);
    lease.stop();
  });

  it('goes idle when told and wakes with a push when interest comes back', async () => {
    const { my, emit, calls } = rpc(false);
    const wake = vi.fn(async () => {});
    const lease = createPageLease(my, 'p1', { wake });
    await lease.refresh();
    expect(lease.active).toBe(false);
    emit('page-interest-changed', { watching: true });
    expect(lease.active).toBe(true);
    await vi.waitFor(() =>
      expect(calls.at(-1)).toEqual({ name: 'page-interest', arg: { pageId: 'p1', synced: true } }),
    );
    expect(wake).toHaveBeenCalledTimes(1);
    // An active page answers a wake the server waits on too.
    emit('page-interest-changed', { watching: true, wake: true });
    await vi.waitFor(() => expect(wake).toHaveBeenCalledTimes(2));
    emit('page-interest-changed', { watching: false, pageId: 'other' });
    expect(lease.active).toBe(true);
    lease.stop();
  });

  it('does not say it is synced when a wake push fails', async () => {
    const { my, emit, calls } = rpc(false);
    const wake = vi.fn(async () => {
      throw new Error('push failed');
    });
    const lease = createPageLease(my, 'p1', { wake });
    await lease.refresh();
    emit('page-interest-changed', { watching: true });
    await vi.waitFor(() => expect(wake).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      calls.some((c) => c.name === 'page-interest' && (c.arg as { synced?: boolean })?.synced),
    ).toBe(false);
    lease.stop();
  });

  it('asks again while idle, in case it missed the server', async () => {
    vi.useFakeTimers();
    const { my, calls } = rpc(false);
    const lease = createPageLease(my, 'p1', { wake: async () => {}, pollMs: 1000 });
    await lease.refresh();
    calls.length = 0;
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls.filter((c) => c.name === 'page-interest')).toHaveLength(3);
    lease.stop();
    vi.useRealTimers();
  });

  it('throttles to one run per interval, with one run at the end', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const run = throttle(fn, 1000);
    run();
    run();
    run();
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(2);
    run();
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe('DOM dirty flags', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads again only after elements came or went', () => {
    let now = 0;
    const dirty = createDomDirty(document, { now: () => now });
    const read = vi.fn(() => document.body.children.length);
    const cached = dirty.cached(read);
    expect(cached()).toBe(0);
    expect(cached()).toBe(0);
    expect(read).toHaveBeenCalledTimes(1);
    // Text and attributes don't change the trees.
    document.body.setAttribute('class', 'x');
    expect(cached()).toBe(0);
    expect(read).toHaveBeenCalledTimes(1);
    document.body.append(document.createElement('div'));
    expect(cached()).toBe(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(cached(true)).toBe(1);
    expect(read).toHaveBeenCalledTimes(3);
    now = 5000;
    cached();
    expect(read).toHaveBeenCalledTimes(4);
    dirty.stop();
  });

  it('follows open shadow roots the walk goes into', () => {
    const host = document.createElement('app-shadow');
    host.setAttribute('ng-version', '22.0.0');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.append(host);
    const dirty = createDomDirty(document);
    const tree = dirty.watch(domTree());
    const read = vi.fn(() => tree.children(host).length);
    const cached = dirty.cached(read);
    expect(cached()).toBe(0);
    shadow.append(document.createElement('span'));
    expect(cached()).toBe(1);
    expect(read).toHaveBeenCalledTimes(2);
    dirty.stop();
  });

  it('does not cache a result `keep` refuses', () => {
    const dirty = createDomDirty(document);
    const read = vi.fn(() => 0);
    const cached = dirty.cached(read, () => false);
    cached();
    cached();
    expect(read).toHaveBeenCalledTimes(2);
    dirty.stop();
  });
});
