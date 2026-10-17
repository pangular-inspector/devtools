import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import {
  AGENT_INSPECTOR,
  AGENT_SAFETY,
  PAGE_AGENT_ENTRIES,
  RPC_INSPECTOR,
  SHARED_STATE_INSPECTOR,
  agentAllowed,
  resolvePangularConfig,
} from '../config.ts';
import {
  RETAINED_AFTER_MS,
  findLeaksText,
  isRetained,
  staleLeakPages,
  toLeaksReport,
  type LeaksReport,
  type LeaksState,
} from '../rpc/leaks-tools.ts';
import { answerText } from './tool-answer.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

async function boot(definition = pangular) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await definition.setup(ctx as never);
  const call = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const invoke = async (id: string, args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke(`pangular:${id}`, args));
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => LeaksState }> };
        }
      ).sharedState.get('pangular:leaks')
    ).value();
  return { ctx, call, invoke, state };
}

const report = (extra: Partial<LeaksReport> = {}): LeaksReport => ({
  pageId: 'tab1',
  url: '/trips',
  title: 'Trips',
  at: Date.now(),
  support: { retention: true, effects: true, subscriptions: 'on', instances: true, detached: true },
  navigations: 4,
  totals: { components: 3, effects: 2, subscriptions: 1, destroyed: 2, collected: 5, dropped: 0 },
  components: [
    { id: 'c1', name: 'TripList', effects: 2, subscriptions: 1 },
    { id: 'c2', name: 'Banner', effects: 0, subscriptions: 0, sharedEffects: 1 },
  ],
  destroyed: [
    {
      id: 'c9',
      name: 'TripCard',
      route: '/trips/7',
      destroyedAt: Date.now() - RETAINED_AFTER_MS - 5000,
      navigations: 3,
      subscriptions: 1,
    },
    { id: 'c10', name: 'TripMap', route: '/trips/8', destroyedAt: Date.now(), navigations: 0 },
  ],
  subscriptions: [
    {
      name: 'TripCard',
      instanceId: 'c9',
      count: 1,
      source: 'TripCard.ngOnInit (trip-card.ts:12:7)',
      route: '/trips/7',
      openedAt: Date.now() - 60_000,
      reason: 'instance-destroyed',
    },
  ],
  ...extra,
});

describe('toLeaksReport', () => {
  it('masks routes, titles and call sites again on the server and drops what is not a report', () => {
    const checked = toLeaksReport(
      report({
        url: `/trips?token=${JWT}`,
        title: `Bearer ${JWT}`,
        destroyed: [
          {
            id: 'c9',
            name: 'TripCard',
            route: `/trips?access_token=${JWT}`,
            destroyedAt: 1,
            navigations: 1,
          },
        ],
        subscriptions: [
          {
            name: 'TripCard',
            count: 1,
            source: `load (api.ts?key=${JWT}:1:1)`,
            route: '/x',
            openedAt: 1,
            reason: 'no-live-instance',
          },
        ],
      }),
    )!;
    expect(JSON.stringify(checked)).not.toContain(JWT);
    expect(toLeaksReport({ url: '/x' })).toBeNull();
    expect(toLeaksReport(null)).toBeNull();
    expect(
      toLeaksReport({ pageId: 'p', support: { subscriptions: 'weird' } })!.support.subscriptions,
    ).toBe('off');
  });
});

describe('isRetained', () => {
  it('needs enough navigations and time, and never counts a detached view', () => {
    const page = { ...report(), reportedAt: Date.now() };
    expect(isRetained(page, page.destroyed[0]!)).toBe(true);
    expect(isRetained(page, page.destroyed[1]!)).toBe(false);
    expect(isRetained(page, { ...page.destroyed[0]!, detached: true })).toBe(false);
    expect(isRetained(page, { ...page.destroyed[0]!, navigations: 1 })).toBe(false);
  });
});

describe('retention held by DI debug data', () => {
  it('keeps the reason through the sanitizer and drops the instances it makes meaningless', () => {
    const base = report().destroyed[0]!;
    const sane = toLeaksReport(
      report({
        support: { retention: 'dev-di-debug', effects: true, subscriptions: 'off' },
        destroyed: [base, { ...base, id: 'c11', detached: true }],
      }),
    )!;
    expect(sane.support.retention).toBe('dev-di-debug');
    expect(sane.destroyed.map((item) => item.id)).toEqual(['c11']);
    expect(
      toLeaksReport(report({ support: { retention: 'yes' as never } } as never))!.support.retention,
    ).toBe(false);
    // The old per-instance flag is not passed on.
    const old = toLeaksReport(report({ destroyed: [{ ...base, devHeld: true } as never] }))!;
    expect(old.destroyed[0]).not.toHaveProperty('devHeld');
  });

  it('says retention is unavailable and why, and still answers subscriptions, detached views and effects', () => {
    const old = Date.now() - RETAINED_AFTER_MS - 5000;
    const page = {
      ...report({
        support: {
          retention: 'dev-di-debug',
          effects: true,
          subscriptions: 'on',
          instances: true,
          detached: true,
        },
        destroyed: [
          {
            id: 'r1',
            name: 'Reused',
            route: '/r',
            destroyedAt: old,
            navigations: 4,
            detached: true,
          },
        ],
      }),
      reportedAt: Date.now(),
    };
    const text = findLeaksText({ pages: { tab1: page } });
    expect(text).toMatch(/## Still retained\n\nNot available on this page/);
    expect(text).toMatch(/DI debug data .*keeps every destroyed component in memory/);
    expect(text).toMatch(/can't tell a leak from that/);
    expect(text).toMatch(/Memory panel/);
    expect(text).not.toMatch(/garbage collected since/);
    expect(text).not.toMatch(/\| Class \| Instance \| Route when destroyed/);
    expect(text).toMatch(/off the page but not destroyed .*`Reused`/);
    expect(text).toMatch(/its instance is destroyed/);
    expect(text).toMatch(/\| `TripList` \| `c1` \| 2 \| 1 \|/);
  });
});

describe('the leaks registration', () => {
  it('keeps one entry per page, forgets a page, and expires a silent one', async () => {
    const { call, state } = await boot();
    await call('push-leaks', report());
    await call('push-leaks', report({ pageId: 'tab2', url: '/about' }));
    expect(Object.keys((await state()).pages).sort()).toEqual(['tab1', 'tab2']);
    expect((await state()).pages['tab1']!.url).toBe('/trips');
    await call('forget-leaks-page', 'tab2');
    expect(Object.keys((await state()).pages)).toEqual(['tab1']);
    expect(staleLeakPages(await state(), Date.now() + 20_000, () => 15_000)).toEqual(['tab1']);
  });

  it('answers find-leaks with retained instances, open subscriptions and live effects', async () => {
    const { call, invoke } = await boot();
    expect(await invoke('find-leaks')).toMatch(/No page reports leak data/);
    await call('push-leaks', report());
    const text = await invoke('find-leaks');
    expect(text).toMatch(/## Still retained/);
    expect(text).toMatch(/\| `TripCard` \| `c9` \| `\/trips\/7` \|/);
    expect(text).toMatch(/not proof of a leak/);
    expect(text).toMatch(/Memory panel/);
    expect(text).toMatch(/destroyed recently and not collected yet: `TripMap`/);
    expect(text).toMatch(/## Open subscriptions after destroy/);
    expect(text).toMatch(/its instance is destroyed/);
    expect(text).toMatch(/takeUntilDestroyed/);
    expect(text).toMatch(/\| `TripList` \| `c1` \| 2 \| 1 \|/);
    expect(text).toMatch(/\| `Banner` \| `c2` \| 0 \(\+1 shared\) \|/);
    expect(await invoke('find-leaks', { component: 'map' })).not.toMatch(/`TripCard`/);
    expect(await invoke('find-leaks', { page: 'nope' })).toMatch(/No page `nope`/);
  });

  it('says what is missing when tracking is off or the page lacks the APIs', () => {
    const page = {
      ...report({
        support: { retention: false, effects: false, subscriptions: 'off' },
        subscriptions: [],
      }),
      reportedAt: Date.now(),
    };
    const text = findLeaksText({ pages: { tab1: page } });
    expect(text).toMatch(/cannot track destroyed components/);
    expect(text).toMatch(/Subscription tracking is off/);
    expect(text).toMatch(/Effects are not counted/);
  });

  it('turns tracking on for one page through the page-side event, and off for every page', async () => {
    const { ctx, call, invoke } = await boot();
    expect(await invoke('track-subscriptions', { action: 'start' })).toMatch(/nothing to track/);
    await call('push-leaks', report());
    await call('push-leaks', report({ pageId: 'tab2' }));
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    expect(await invoke('track-subscriptions', { action: 'start', page: 'tab1' })).toMatch(
      /Tracking subscriptions on page `tab1`/,
    );
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'pangular:leak-tracking',
        args: [{ pageId: 'tab1', on: true }],
      }),
    );
    broadcast.mockClear();
    expect(await invoke('track-subscriptions', { action: 'stop' })).toMatch(/every page/);
    const args = broadcast.mock.calls.map(([options]) => (options as { args: unknown[] }).args[0]);
    expect(args).toEqual(
      expect.arrayContaining([
        { pageId: 'tab1', on: false },
        { pageId: 'tab2', on: false },
      ]),
    );
    expect(await call('request-leak-tracking', { pageId: 'tab2', on: true })).toEqual({
      pages: 1,
    });
  });

  it('is part of the Components inspector, and track-subscriptions is an action', async () => {
    for (const name of ['push-leaks', 'forget-leaks-page', 'request-leak-tracking']) {
      expect(RPC_INSPECTOR[name]).toBe('components');
    }
    expect(AGENT_INSPECTOR['find-leaks']).toBe('components');
    expect(AGENT_INSPECTOR['track-subscriptions']).toBe('components');
    expect(SHARED_STATE_INSPECTOR['leaks']).toBe('components');
    expect(AGENT_SAFETY['track-subscriptions']).toBe('action');
    expect(PAGE_AGENT_ENTRIES).toEqual(
      expect.arrayContaining(['find-leaks', 'track-subscriptions']),
    );
    const readOnly = resolvePangularConfig({ agent: { readOnly: true } });
    expect(agentAllowed({ id: 'pangular:find-leaks' }, readOnly)).toBe(true);
    expect(agentAllowed({ id: 'pangular:track-subscriptions' }, readOnly)).toBe(false);

    const { ctx } = await boot(createPangular({ inspectors: { components: false } }));
    const tools = ctx.agent.list().tools.map((tool: { id: string }) => tool.id);
    expect(tools).not.toContain('pangular:find-leaks');
    expect(tools).not.toContain('pangular:track-subscriptions');
  });
});
