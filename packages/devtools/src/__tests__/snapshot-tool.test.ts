import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import type { PangularConfig } from '../config.ts';
import pangular, { createPangular } from '../devframe.ts';
import type { CollectedForm } from '../forms.ts';
import { UNTRUSTED } from '../rpc/forms-tools.ts';
import { SNAPSHOT_SECTION_CHARS } from '../rpc/snapshot-tools.ts';
import type { LiveComponentNode } from '../types.ts';
import { answerText } from './tool-answer.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

async function boot(options?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (options ? createPangular(options) : pangular).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const snapshot = async (args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke('pangular:snapshot', args));
  const tools = ctx.agent.list().tools.map((tool) => tool.id);
  return { push, snapshot, tools };
}

const card: LiveComponentNode = { id: 'c2', name: 'TripCard', tag: 'app-trip-card', children: [] };
const roots: LiveComponentNode[] = [{ id: 'c1', name: 'App', tag: 'app-root', children: [card] }];

const form: CollectedForm = {
  id: 'Checkout.form@tab1',
  kind: 'reactive',
  owner: 'Checkout',
  property: 'form',
  label: 'Checkout.form',
  submitted: false,
  root: {
    key: 'form',
    path: '',
    type: 'group',
    status: 'INVALID',
    touched: false,
    dirty: false,
    bound: false,
    errors: [],
    children: [],
  },
};

function routerReport(pageId: string, url = '/trips') {
  return {
    pageId,
    generation: 1,
    snapshot: {
      url,
      queryParams: {},
      fragment: null,
      root: {
        path: '',
        url: '',
        outlet: 'primary',
        params: {},
        data: {},
        children: [
          {
            path: 'trips',
            url: 'trips',
            outlet: 'primary',
            component: 'TripsPage',
            params: {},
            data: {},
            children: [],
          },
        ],
      },
    },
    navigations: [
      {
        id: 1,
        url: '/',
        trigger: 'imperative',
        startedAt: 1000,
        endedAt: 1010,
        outcome: 'succeeded',
      },
      {
        id: 2,
        url: url,
        trigger: 'popstate',
        startedAt: 2000,
        endedAt: 2030,
        outcome: 'succeeded',
      },
    ],
  };
}

function httpCall(id: string, url: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    url,
    method: 'GET',
    status: 200,
    durationMs: 12,
    side: 'client',
    at: Date.now(),
    ...extra,
  };
}

function errorsReport(pageId: string, message = 'Error: No seats left', console: unknown[] = []) {
  return {
    pageId,
    full: true,
    url: '/trips',
    title: 'Trips',
    handler: 'wrapped',
    errors: [
      {
        id: 'e1',
        message,
        name: 'Error',
        count: 2,
        firstAt: Date.now() - 10_000,
        lastAt: Date.now() - 1_000,
        sources: ['handler'],
        owner: { id: 'c2', name: 'TripCard' },
      },
    ],
    console: console.length
      ? console
      : [{ id: 1, level: 'warn', text: 'Slow trips load', at: Date.now(), count: 1 }],
    dropped: { errors: 0, console: 0 },
  };
}

/** Every inspector reports for `tab1`. */
async function pushAll(push: (name: string, payload: unknown) => Promise<unknown>) {
  await push('push-component-tree', {
    pageId: 'tab1',
    url: 'http://localhost:4200/trips',
    title: 'Trips',
    roots,
    count: 2,
    detail: null,
  });
  await push('push-router', routerReport('tab1'));
  await push('push-http', {
    pageId: 'tab1',
    url: 'http://localhost:4200/trips',
    payload: { entries: [] },
    calls: [httpCall('h1', '/api/trips'), httpCall('h2', '/api/book', { status: 500 })],
  });
  await push('push-errors', errorsReport('tab1'));
  await push('push-forms', { pageId: 'tab1', forms: [form], events: [] });
  await push('push-signal-graph', {
    pageId: 'tab1',
    nodes: [{ id: 'a', kind: 'signal', label: 'tripCount', epoch: 1, value: 3 }],
    edges: [],
    componentSelector: 'app-root',
    component: { id: 'c1', name: 'App', tag: 'app-root', path: 'app-root' },
  });
  await push('push-ngrx-state', {
    pageId: 'tab1',
    session: 's1',
    url: '/trips',
    stores: [],
    classic: { state: { cart: { items: 2 } }, devtools: false, scope: 'root' },
    log: [],
  });
}

describe('snapshot agent tool', () => {
  it('is registered as a shared, read-only tool', async () => {
    const { tools } = await boot();
    expect(tools).toContain('pangular:snapshot');
  });

  it('renders every section from what the pages pushed, behind one notice', async () => {
    const { push, snapshot } = await boot();
    await pushAll(push);
    const text = await snapshot();
    expect(text.startsWith(`${UNTRUSTED}\n\n# Snapshot of page \`tab1\``)).toBe(true);
    // The notice appears once: the sections' own notices are dropped.
    expect(text.split('come from the running').length).toBe(2);

    expect(text).toContain('## Page');
    expect(text).toMatch(/- URL: `http:\/\/localhost:4200\/trips`/);
    expect(text).toMatch(/- Reports: .*components/);

    expect(text).toContain('## Components');
    expect(text).toContain('TripCard <app-trip-card> c2');

    expect(text).toContain('## Current route');
    expect(text).toContain('`TripsPage`');

    expect(text).toContain('## Recent navigations');
    expect(text).toMatch(/2 navigation\(s\) recorded, newest first\.\n\n- #2 `\/trips`/);

    expect(text).toContain('## HTTP calls');
    expect(text).toContain('GET `/api/book`');

    expect(text).toContain('## Errors');
    expect(text).toContain('Error: No seats left');
    expect(text).toContain('## Console');
    expect(text).toContain('Slow trips load');

    expect(text).toContain('## Forms');
    expect(text).toContain('Checkout.form@tab1');

    expect(text).toContain('## Signals');
    expect(text).toMatch(/```json\n\{[^`]*"label": "tripCount"/);

    expect(text).toContain('## Stores');
    expect(text).toContain('"items": 2');

    // Nothing pushed for TanStack Query, so the section is named as empty.
    expect(text).toMatch(/Nothing reported by this page for: .*`queries`/);
    expect(text).not.toContain('## TanStack Query');
    // Each section points at the tool with the rest.
    expect(text).toContain('_From pangular:list-http-calls._');
  });

  it('renders TanStack Query and keeps headings under the section heading', async () => {
    const { push, snapshot } = await boot();
    await push('push-tanstack-query', {
      pageId: 'tab1',
      url: '/trips',
      title: 'Trips',
      at: Date.now(),
      clients: [{ id: 'c1', scope: 'root', queries: 1, mutations: 0 }],
      queries: [
        {
          id: 'q1',
          clientId: 'c1',
          key: ['trips'],
          keyText: '["trips"]',
          status: 'success',
          fetchStatus: 'idle',
          stale: true,
          invalidated: false,
          observers: 1,
          active: true,
          disabled: false,
          dataUpdatedAt: Date.now(),
          errorUpdatedAt: 0,
          dataUpdateCount: 1,
          failureCount: 0,
          staleTime: 0,
          gcTime: 300_000,
          hasData: true,
        },
      ],
      mutations: [],
    });
    const text = await snapshot({ sections: ['queries'] });
    expect(text).toContain('## TanStack Query');
    expect(text).toContain('### TanStack Query on `tab1`');
    expect(text).toContain('#### Queries (1 of 1)');
    expect(text).toContain('`q1`');
  });

  it('lists only the sections asked for, and refuses unknown ones', async () => {
    const { push, snapshot } = await boot();
    await pushAll(push);
    const text = await snapshot({ sections: ['http', 'errors'] });
    expect(text).toContain('## HTTP calls');
    expect(text).toContain('## Errors');
    expect(text).not.toContain('## Components');
    expect(text).not.toContain('## Page');
    expect(await snapshot({ sections: ['http', 'bogus'] })).toMatch(
      /^`sections\[1\]` must be one of `page`, .*not a string \("bogus"\)\./,
    );
  });

  it('skips the sections whose inspector or agent tools are off', async () => {
    const { push, snapshot, tools } = await boot({
      inspectors: { forms: false },
      agent: { tools: { http: false } },
    });
    expect(tools).toContain('pangular:snapshot');
    // With the Forms inspector off, its push RPC is not registered at all.
    await pushAll((name, payload) =>
      name === 'push-forms' ? Promise.resolve() : push(name, payload),
    );
    const text = await snapshot();
    expect(text).toMatch(
      /Skipped: `http` \(`agent\.tools\.http` is off\), `forms` \(`inspectors\.forms` is off\)\./,
    );
    expect(text).not.toContain('## HTTP calls');
    expect(text).not.toContain('## Forms');
    expect(text).not.toContain('/api/book');
    expect(text).toContain('## Errors');
  });

  it('cuts sections to `limit` items and the answer to `maxChars`', async () => {
    const { push, snapshot } = await boot();
    await pushAll(push);
    const console = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      level: 'log',
      text: `line ${i + 1} ${'x'.repeat(200)}`,
      at: Date.now() - (60 - i) * 1000,
      count: 1,
    }));
    await push('push-errors', errorsReport('tab1', 'Error: No seats left', console));

    const limited = await snapshot({ sections: ['console'], limit: 3 });
    expect(limited).toContain('57 more; raise `limit`');
    expect(limited.match(/\| log \|/g)).toHaveLength(3);

    // A section never passes its own cap.
    const full = await snapshot({ sections: ['console'], limit: 50, maxChars: 50_000 });
    const section = full.slice(full.indexOf('## Console'));
    expect(section.length).toBeLessThan(SNAPSHOT_SECTION_CHARS + 200);
    expect(section).toContain('Call pangular:list-console for the rest.');

    const small = await snapshot({ maxChars: 2_000, limit: 50 });
    expect(small.length).toBeLessThanOrEqual(2_000);
    expect(small.startsWith(UNTRUSTED)).toBe(true);
    expect(small).toMatch(/_Truncated at 2,000 characters: .*left out .*`forms`.*Pass `sections`/);
  });

  it('masks secrets in URLs, messages and titles', async () => {
    const { push, snapshot } = await boot();
    await push('push-http', {
      pageId: 'tab1',
      url: 'http://localhost:4200/cb?access_token=abc123xyz&tab=1',
      payload: { entries: [] },
      calls: [httpCall('h1', '/api/me?access_token=abc123xyz&tab=1')],
    });
    await push('push-errors', errorsReport('tab1', `Unauthorized: Bearer ${JWT}`));
    const text = await snapshot();
    expect(text).not.toMatch(/abc123xyz|eyJhbGci/);
    expect(text).toContain('tab=1');
    expect(text).toContain('Unauthorized');
  });

  it('picks the page from `page`, refuses the old `pageId`, and answers for an unknown one', async () => {
    const { push, snapshot } = await boot();
    expect(await snapshot()).toMatch(/^No page is reporting/);
    await push('push-router', routerReport('tab1', '/one'));
    await push('push-router', routerReport('tab2', '/two'));
    expect(await snapshot({ page: 'tab1', sections: ['route'] })).toContain('**URL** `/one`');
    expect(await snapshot({ page: 'tab2', sections: ['route'] })).toContain('**URL** `/two`');
    expect(await snapshot({ pageId: 'tab2' })).toMatch(
      /There is no `pageId` argument; pass `page`/,
    );
    const unknown = await snapshot({ page: 'nope' });
    expect(unknown).toMatch(/No page `nope` is reporting live data/);
    expect(unknown).toContain('`tab1`');
  });
});
