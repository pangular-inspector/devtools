import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageInterest, leased, panelWatching } from '../rpc/page-interest.ts';

const client = (...states: string[]) => ({ $meta: { subscribedStates: new Set(states) } });

function setup(clients: unknown[] = [], leaseMs = 60_000) {
  let now = 1000;
  const host = { _rpcGroup: { clients } };
  const sent: unknown[] = [];
  const hidden = new Set<string>();
  const interest = createPageInterest({
    rpcHost: host,
    leaseMs,
    broadcast: (message) => sent.push(message),
    hidden: (pageId) => hidden.has(pageId),
    now: () => now,
    waitMs: 200,
  });
  return {
    interest,
    sent,
    hidden,
    clients,
    advance: (ms: number) => (now += ms),
  };
}

describe('page interest', () => {
  afterEach(() => vi.useRealTimers());

  it('watches while a connected panel follows a page state', () => {
    expect(panelWatching({ _rpcGroup: { clients: [client('pangular:errors')] } })).toBe(false);
    expect(panelWatching({ _rpcGroup: { clients: [client('pangular:component-tree')] } })).toBe(
      true,
    );
    expect(panelWatching({ _rpcGroup: { clients: [client('pangular:forms')] } })).toBe(true);
    // A host that hides its clients can't say nobody watches.
    expect(panelWatching({})).toBe(true);
  });

  it('tells pages when a panel opens and closes', () => {
    const { interest, sent, clients } = setup();
    interest.tick();
    expect(sent).toEqual([{ watching: false }]);
    interest.tick();
    expect(sent).toHaveLength(1);
    clients.push(client('pangular:component-tree'));
    interest.tick();
    expect(sent.at(-1)).toEqual({ watching: true });
    clients.length = 0;
    interest.tick();
    expect(sent.at(-1)).toEqual({ watching: false });
  });

  it('keeps pages pushing for the lease after an agent call', async () => {
    const { interest, sent, advance } = setup();
    interest.tick();
    await interest.touch();
    expect(interest.watching()).toBe(true);
    expect(sent.at(-1)).toEqual({ watching: true });
    advance(59_000);
    interest.tick();
    expect(interest.watching()).toBe(true);
    advance(2000);
    interest.tick();
    expect(sent.at(-1)).toEqual({ watching: false });
  });

  it('wakes idle pages and waits until each sent its reports', async () => {
    const { interest, sent, hidden } = setup();
    interest.tick();
    interest.handle({ pageId: 'p1' });
    interest.handle({ pageId: 'p2' });
    interest.handle({ pageId: 'p3' });
    hidden.add('p3');
    let answered = false;
    const touched = interest.touch().then(() => (answered = true));
    expect(sent.at(-1)).toEqual({ watching: true, wake: true });
    interest.handle({ pageId: 'p1', synced: true });
    await Promise.resolve();
    expect(answered).toBe(false);
    interest.handle({ pageId: 'p2', synced: true });
    await touched;
    expect(answered).toBe(true);
  });

  it('answers the agent after a short wait when a page does not wake', async () => {
    vi.useFakeTimers();
    const { interest } = setup();
    interest.tick();
    interest.handle({ pageId: 'p1' });
    let answered = false;
    void interest.touch().then(() => (answered = true));
    await vi.advanceTimersByTimeAsync(199);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(answered).toBe(true);
  });

  it('never goes idle with the lease off', async () => {
    const { interest, sent } = setup([], 0);
    interest.tick();
    expect(sent).toEqual([{ watching: true }]);
    expect(interest.handle({ pageId: 'p1' })).toEqual({ watching: true });
  });

  it('renews the lease before a tool handler runs', async () => {
    const { interest } = setup();
    const handler = leased(
      () => interest,
      (args: { x: number }) => args.x * 2,
    );
    expect(interest.watching()).toBe(false);
    expect(await handler({ x: 2 })).toBe(4);
    expect(interest.watching()).toBe(true);
  });
});
