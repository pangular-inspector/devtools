import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { createPageOwners } from '../rpc/page-owners.ts';
import { PAGE_TTL_MS } from '../rpc/page-ttl.ts';
import { fixtureDir } from '../rpc/__tests__/fixture-dir.ts';

/** A stand-in for a page key: not a real secret, just 32 characters. */
const keyOf = (name: string) => name.padEnd(32, '0');

function fakeHost() {
  let current: number | undefined;
  const host = {
    getCurrentRpcSession: () => (current === undefined ? undefined : { meta: { id: current } }),
    _emitSessionDisconnected: (_meta: { id: number }) => {},
  };
  return {
    host,
    as: (session: number | undefined) => {
      current = session;
    },
    close: (session: number) => host._emitSessionDisconnected({ id: session }),
  };
}

describe('page owners', () => {
  afterEach(() => vi.useRealTimers());

  it('gives a page to the first connection and refuses another one', () => {
    const { host, as } = fakeHost();
    const owners = createPageOwners(host, () => PAGE_TTL_MS);
    as(1);
    expect(owners.write('tab-1')).toBe(true);
    as(2);
    expect(owners.write('tab-1')).toBe(false);
    expect(owners.forget('tab-1')).toBe(false);
    expect(owners.write('tab-2')).toBe(true);
    as(1);
    expect(owners.write('tab-1')).toBe(true);
  });

  it('hands the page over at once to a connection that shows its key', () => {
    const { host, as } = fakeHost();
    const owners = createPageOwners(host, () => PAGE_TTL_MS);
    as(1);
    expect(owners.claim('tab-1', keyOf('a'))).toBe(true);
    expect(owners.write('tab-1')).toBe(true);
    as(2);
    expect(owners.claim('tab-1', keyOf('b'))).toBe(false);
    expect(owners.write('tab-1')).toBe(false);
    expect(owners.claim('tab-1', keyOf('a'))).toBe(true);
    expect(owners.write('tab-1')).toBe(true);
    // The old connection lost the page.
    as(1);
    expect(owners.write('tab-1')).toBe(false);
    expect(owners.forget('tab-1')).toBe(false);
  });

  it('refuses a key for a page that was reported without one while its owner is alive', () => {
    const { host, as } = fakeHost();
    const owners = createPageOwners(host, () => PAGE_TTL_MS);
    as(1);
    owners.write('tab-1');
    as(2);
    expect(owners.claim('tab-1', keyOf('a'))).toBe(false);
    expect(owners.claim('tab-1', '')).toBe(false);
    expect(owners.claim('tab-1', 42)).toBe(false);
  });

  it('lets a new connection take over once the owner closed', () => {
    const { host, as, close } = fakeHost();
    const owners = createPageOwners(host, () => PAGE_TTL_MS);
    as(1);
    owners.claim('tab-1', keyOf('a'));
    close(1);
    as(2);
    expect(owners.write('tab-1')).toBe(true);
    // The key outlives the connection, so a later reload can still show it.
    as(3);
    expect(owners.claim('tab-1', keyOf('a'))).toBe(true);
    as(2);
    expect(owners.write('tab-1')).toBe(false);
  });

  it('lets a new connection take over once the owner went quiet past the page expiry', () => {
    vi.useFakeTimers();
    const { host, as } = fakeHost();
    const owners = createPageOwners(host, () => PAGE_TTL_MS);
    as(1);
    owners.write('tab-1');
    vi.advanceTimersByTime(PAGE_TTL_MS - 1);
    as(2);
    expect(owners.write('tab-1')).toBe(false);
    vi.advanceTimersByTime(2);
    expect(owners.write('tab-1')).toBe(true);
  });

  it('allows calls made in-process, outside an RPC request', () => {
    const { host, as } = fakeHost();
    const owners = createPageOwners(host, () => PAGE_TTL_MS);
    as(1);
    owners.write('tab-1');
    as(undefined);
    expect(owners.write('tab-1')).toBe(true);
    expect(owners.forget('tab-1')).toBe(true);
  });
});

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const cwd = fixtureDir('pangular-page-owners-');
  const ctx = await createHostContext({ cwd, mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const rpc = ctx.rpc as unknown as {
    getCurrentRpcSession: () => unknown;
    _emitSessionDisconnected: (meta: { id: number }) => void;
    sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
  };
  const as = (session: number) => {
    rpc.getCurrentRpcSession = () => ({ meta: { id: session } });
  };
  const invoke = (name: string, ...args: unknown[]) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...(args as never));
  const counts = async () => {
    const state = (await rpc.sharedState.get('pangular:component-tree')).value() as {
      pages: Record<string, { count: number }>;
    };
    return Object.fromEntries(Object.entries(state.pages).map(([id, page]) => [id, page.count]));
  };
  return { rpc, as, invoke, counts };
}

describe('page ownership on the devframe server', () => {
  it('ignores a push or a forget for another connection’s page', async () => {
    const { as, invoke, counts } = await boot();
    as(1);
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 3 });
    as(2);
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 99 });
    expect(await counts()).toEqual({ 'tab-1': 3 });
    await invoke('forget-component-page', 'tab-1');
    expect(await counts()).toEqual({ 'tab-1': 3 });
    // Ownership is per page, not per inspector.
    await invoke('push-injector-tree', { pageId: 'tab-1', roots: [], environment: [] });
    expect(await invoke('ping-component-tree', 'tab-1')).toEqual({ known: false });
  });

  it('gives a reloaded page its own page id back at once', async () => {
    const { as, invoke, counts } = await boot();
    const key = keyOf('reload');
    as(1);
    expect(await invoke('claim-page', { pageId: 'tab-1', key })).toEqual({ ok: true });
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 3 });
    // The reload connects again before the old connection is seen closing.
    as(2);
    expect(await invoke('claim-page', { pageId: 'tab-1', key })).toEqual({ ok: true });
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 4 });
    expect(await counts()).toEqual({ 'tab-1': 4 });
    // A late report from the old connection no longer lands.
    as(1);
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 3 });
    expect(await counts()).toEqual({ 'tab-1': 4 });
  });

  it('refuses a claim with the wrong key while the owner is alive', async () => {
    const { as, invoke } = await boot();
    as(1);
    await invoke('claim-page', { pageId: 'tab-1', key: keyOf('a') });
    as(2);
    expect(await invoke('claim-page', { pageId: 'tab-1', key: keyOf('b') })).toEqual({
      ok: false,
    });
  });

  it('lets a page without its key back once the old connection closed', async () => {
    const { rpc, as, invoke, counts } = await boot();
    as(1);
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 3 });
    rpc._emitSessionDisconnected({ id: 1 });
    as(2);
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 4 });
    expect(await counts()).toEqual({ 'tab-1': 4 });
  });

  it('never lets two tabs overwrite each other', async () => {
    const { as, invoke, counts } = await boot();
    as(1);
    await invoke('claim-page', { pageId: 'tab-1', key: keyOf('one') });
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 1 });
    as(2);
    await invoke('claim-page', { pageId: 'tab-2', key: keyOf('two') });
    await invoke('push-component-tree', { pageId: 'tab-2', roots: [], count: 2 });
    // Each tab writing the other's page id is ignored.
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 22 });
    as(1);
    await invoke('push-component-tree', { pageId: 'tab-2', roots: [], count: 11 });
    await invoke('forget-component-page', 'tab-2');
    expect(await counts()).toEqual({ 'tab-1': 1, 'tab-2': 2 });
    // A tab still forgets its own page.
    await invoke('forget-component-page', 'tab-1');
    expect(await counts()).toEqual({ 'tab-2': 2 });
  });

  it('settles a page request only with the answer from that page’s owner', async () => {
    const { as, invoke, rpc } = await boot();
    as(1);
    await invoke('push-component-tree', { pageId: 'tab-1', roots: [], count: 1 });
    const broadcast = vi.spyOn(rpc as never as { broadcast: () => Promise<void> }, 'broadcast');
    broadcast.mockImplementation((async (options: { args: [{ requestId: string }] }) => {
      const { requestId } = options.args[0];
      // Another connection answers for tab-1, then with a page of its own.
      as(2);
      await invoke('router-action-result', { requestId, pageId: 'tab-1', result: 'forged' });
      await invoke('router-action-result', { requestId, pageId: 'tab-2', result: 'forged' });
      as(1);
      await invoke('router-action-result', { requestId, pageId: 'tab-1', result: 'real' });
    }) as never);
    as(3);
    expect(
      await invoke('request-router-action', {
        pageId: 'tab-1',
        request: { action: 'probe', url: '/' },
      }),
    ).toBe('real');
  });

  it('applies the same rule to every inspector that takes reports', async () => {
    const { as, invoke, rpc } = await boot();
    const state = async (key: string) => (await rpc.sharedState.get(`pangular:${key}`)).value();
    as(1);
    await invoke('push-injector-tree', { pageId: 'tab-1', roots: [], environment: [] });
    await invoke('push-signal-graph', { pageId: 'tab-1', nodes: [], edges: [] });
    await invoke('push-change-detection', { pageId: 'tab-1', cycles: [] });
    as(2);
    for (const name of [
      'forget-injector-page',
      'forget-signal-page',
      'forget-change-detection-page',
      'forget-pipes-page',
      'forget-router-page',
      'forget-http-page',
      'forget-forms-page',
      'forget-ngrx-page',
      'forget-capacitor-page',
    ]) {
      await invoke(name, 'tab-1');
    }
    expect(((await state('injector-tree')) as { pages: object }).pages).toHaveProperty('tab-1');
    expect(((await state('signal-graph')) as { pages: object }).pages).toHaveProperty('tab-1');
    expect(await invoke('ping-injector-tree', 'tab-1')).toEqual({ known: false });
    expect(await invoke('ping-signal-graph', 'tab-1')).toEqual({ known: false });
    as(1);
    expect(await invoke('ping-injector-tree', 'tab-1')).toEqual({ known: true });
    expect(await invoke('ping-signal-graph', 'tab-1')).toEqual({ known: true });
  });
});
