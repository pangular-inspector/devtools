import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import { createPangular } from '../devframe.ts';
import type { PangularConfig } from '../config.ts';
import type { HydrationReport, LiveComponentNode } from '../types.ts';
import { answerText } from './tool-answer.ts';

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown>) =>
    await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
  const sent: { method: string; args: [Record<string, unknown>] }[] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: (typeof sent)[number]) => {
    sent.push(options);
  }) as never);
  const tree = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: {
            get: (key: string) => Promise<{
              value: () => { pages: Record<string, { hydration?: HydrationReport }> };
            }>;
          };
        }
      ).sharedState.get('pangular:component-tree')
    ).value();
  return { ctx, push, call, sent, tree };
}

const roots: LiveComponentNode[] = [
  {
    id: 'c1',
    name: 'App',
    tag: 'app-root',
    hydration: 'hydrated',
    children: [
      {
        id: 'c2',
        name: 'RouterLink',
        tag: 'a',
        kind: 'directive',
        directives: ['RouterLink', 'RouterLinkActive'],
        attributes: ['routerLink', 'routerLinkActive'],
        children: [],
      },
      {
        id: 'c3',
        name: 'TripMap',
        tag: 'app-map',
        hydration: 'skipped',
        children: [
          {
            id: 'c4',
            name: 'MatTooltip',
            tag: 'button',
            kind: 'directive',
            directives: ['MatTooltip'],
            attributes: ['matTooltip'],
            children: [],
          },
        ],
      },
      { id: 'c5', name: 'Price', tag: 'app-price', hydration: 'mismatched', children: [] },
      { id: 'c6', name: 'Toast', tag: 'app-toast', hydration: 'client', children: [] },
    ],
  },
];

const hydration: HydrationReport = {
  hydrated: true,
  counts: { hydrated: 1, skipped: 1, mismatched: 1, client: 1, dehydratedBlocks: 1 },
  mismatches: [{ id: 'c5', name: 'Price', tag: 'app-price', expected: '<div>', actual: '<span>' }],
};

const report = {
  pageId: 'p1',
  url: 'http://localhost:4000/trips',
  roots,
  count: 4,
  directiveHostCount: 2,
  detail: null,
  hydration,
  deferBlocks: [
    {
      id: 'd1',
      owner: { id: 'c1', name: 'App', tag: 'app-root' },
      state: 'placeholder',
      hydration: 'dehydrated',
      triggers: ['hydrate on viewport', 'on viewport'],
      hasErrorBlock: false,
      rootIds: [],
      since: 0,
    },
  ],
};

describe('hydration tool', () => {
  it('summarizes hydration by status and names skipped, mismatched, client and dehydrated', async () => {
    const { push, call } = await boot();
    await push('push-component-tree', report);
    const text = await call('hydration', {});
    expect(text).toContain('Page `p1` (`http://localhost:4000/trips`): hydrated from server HTML.');
    expect(text).toContain('| Skipped (ngSkipHydration) | 1 |');
    expect(text).toContain('Skipped: `TripMap` `<app-map>` `c3`');
    expect(text).toContain('- `Price` `<app-price>` `c5`');
    // The server HTML Angular expected against the client DOM it found, as a diff.
    expect(text).toContain('  ```diff\n  - <div>\n  + <span>\n  ```');
    expect(text).toContain(
      'Created on the client (after hydration, or inside a skipped host): `Toast`',
    );
    expect(text).toContain('Dehydrated @defer blocks: `d1` in `App` (hydrate on viewport).');
  });

  it('says when a page was not rendered on the server, or not hydrated', async () => {
    const { push, call } = await boot();
    await push('push-component-tree', { ...report, hydration: undefined });
    expect(await call('hydration', {})).toMatch(/not rendered on the server/);
    await push('push-component-tree', {
      ...report,
      hydration: { ...hydration, hydrated: false },
    });
    expect(await call('hydration', {})).toMatch(/no component host was hydrated/);
    expect(await call('hydration', { page: 'gone' })).toMatch(/No page `gone`/);
  });

  it('keeps only the report fields the server knows', async () => {
    const { push, tree } = await boot();
    await push('push-component-tree', {
      ...report,
      hydration: { ...hydration, counts: { ...hydration.counts, hydrated: -3 }, extra: 'x' },
    });
    const kept = (await tree()).pages['p1'].hydration!;
    expect(kept.counts.hydrated).toBe(0);
    expect(kept).not.toHaveProperty('extra');
  });

  it('highlight turns the hydration overlay on for a page that reports hydration, and off', async () => {
    const { push, call, sent } = await boot();
    await push('push-component-tree', report);
    const on = await call('highlight', { hydration: true });
    expect(on).toMatch(/^Sent the request to outline hydration on page `p1`/);
    expect(sent.at(-1)).toMatchObject({
      method: 'pangular:hydration-overlay',
      args: [{ on: true }],
    });
    await call('highlight', { hydration: false, page: 'p1' });
    expect(sent.at(-1)?.args[0]).toEqual({ pageId: 'p1', on: false });
  });

  it('sends no overlay request when no page reports hydration', async () => {
    const { push, call, sent } = await boot();
    await push('push-component-tree', { ...report, hydration: undefined });
    expect(await call('highlight', { hydration: true })).toMatch(/^No page reports hydration/);
    expect(sent.some((entry) => entry.method.endsWith('hydration-overlay'))).toBe(false);
  });

  it('keeps hydration a read with no overlay argument, and the outline a highlight', async () => {
    const { push, call, sent, ctx } = await boot({ agent: { readOnly: true } });
    await push('push-component-tree', report);
    const tool = ctx.agent.list().tools.find((t) => t.id === 'pangular:hydration')!;
    expect(tool.safety).toBe('read');
    expect(Object.keys((tool.inputSchema as { properties: object }).properties)).toEqual(['page']);
    // `overlay` moved to highlight, so the read refuses it and draws nothing.
    expect(await call('hydration', { overlay: true })).toContain(
      '`pangular:highlight` with `hydration`',
    );
    expect(await call('hydration', {})).toContain('hydrated from server HTML');
    expect(sent.some((entry) => entry.method.endsWith('hydration-overlay'))).toBe(false);
    // The outline is a page drawing like any highlight, so read-only mode keeps it.
    expect(await call('highlight', { hydration: true })).toMatch(
      /^Sent the request to outline hydration/,
    );
    expect(await call('highlight', { hydration: true, component: 'App' })).toMatch(
      /^Pass one of `component`/,
    );
  });

  it('forwards the panel request to the page it names', async () => {
    const { push, sent } = await boot();
    await push('request-hydration-overlay', { pageId: 'p1', on: true });
    await push('request-hydration-overlay', { pageId: 'p1', on: 'yes' });
    expect(sent.filter((entry) => entry.method.endsWith('hydration-overlay'))).toEqual([
      { method: 'pangular:hydration-overlay', args: [{ pageId: 'p1', on: true }], optional: true },
    ]);
  });
});

describe('directive hosts and search syntax for agents', () => {
  it('list-components shows directive hosts, hydration markers and the search syntax', async () => {
    const { push, call } = await boot();
    await push('push-component-tree', report);
    const all = await call('list-components', {});
    expect(all).toContain('4 component instance(s) and 2 directive host(s)');
    expect(all).toContain(
      '  <a> [routerLink] [routerLinkActive] c2 [directive host: RouterLink, RouterLinkActive]',
    );
    expect(all).toContain('TripMap <app-map> c3 [hydration: skipped]');
    expect(all).not.toContain('App <app-root> c1 [hydration');

    const buttons = await call('list-components', { filter: '<button> [matTooltip]' });
    expect(buttons).toContain('<button> [matTooltip] c4');
    expect(buttons).toContain('TripMap <app-map> c3');
    expect(buttons).not.toContain('Price');

    const hidden = await call('list-components', { directiveHosts: false });
    expect(hidden).not.toContain('[directive host');
    expect(hidden).toContain('4 component instance(s).');
  });

  it('inspect-component answers for a directive host without waiting for a detail', async () => {
    const { push, call, sent } = await boot();
    await push('push-component-tree', report);
    const text = await call('inspect-component', { component: 'c2' });
    expect(text).toContain('is a `<a>` that hosts `RouterLink`, `RouterLinkActive`');
    expect(sent.some((entry) => entry.method.endsWith('inspect-component-in-page'))).toBe(false);
    // A class name names a component, not a directive host.
    expect(await call('inspect-component', { component: 'RouterLink' })).toMatch(
      /No component instance matches/,
    );
  });
});
