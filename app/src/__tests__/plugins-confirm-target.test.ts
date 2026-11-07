import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { travelView, type TravelSource } from '../../../src/app/devtools/travel-plugin';
import { PluginsInspector } from '../pages/plugins-inspector';

const source = (saved = ['kyoto']): TravelSource => ({
  bookings: () => [
    {
      id: 'TRV-1041',
      destinationName: 'Kyoto',
      startDate: '2026-11-02',
      travelers: 2,
      total: 3120,
      email: 'ada@example.com',
    },
    {
      id: 'TRV-1042',
      destinationName: 'Lisbon',
      startDate: '2026-12-10',
      travelers: 1,
      total: 980,
      email: 'grace@example.com',
    },
  ],
  saved: () => saved,
  recentQueries: () => ['beach'],
  filters: () => ({ query: '', region: 'Europe', sort: 'price' }),
  unsaveAll: () => {},
});

const page = (pageId: string, extra: Record<string, unknown> = {}) => ({
  pageId,
  url: `http://localhost/${pageId}`,
  title: `Travel ${pageId}`,
  reportedAt: 5_000,
  plugins: [
    {
      id: 'travel',
      version: '1.0.0',
      title: 'Travel store',
      description: 'Bookings from the demo TravelStore.',
      apiVersion: 1,
      status: 'running',
      view: travelView(source()),
      actions: ['unsave-all'],
      ...extra,
    },
  ],
});

function fakeClient(value: unknown, configs: Record<string, unknown> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const rpc = {
    call: (name: string, ...args: unknown[]) => {
      calls.push({ name, args });
      return Promise.resolve(name === 'request-plugin-action' ? { ok: true } : []);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'plugins' ? value : null),
        on: () => () => {},
      }),
  };
  const client = {
    status: 'connected',
    connectionMeta: { configs },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
  return { client, calls };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const host = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<unknown>) =>
  (host(fixture).textContent ?? '').replace(/\s+/g, ' ');

async function mount(value: unknown, configs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(PluginsInspector);
  const fake = fakeClient(value, configs);
  fixture.componentRef.setInput('rpc', fake.client);
  document.body.append(host(fixture));
  await settle(fixture);
  return { fixture, calls: fake.calls };
}

function button(fixture: ComponentFixture<unknown>, name: string): HTMLButtonElement {
  const found = [...host(fixture).querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(name),
  );
  if (!found) throw new Error(`No button ${name}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = '';
});

const queryPage = (pageId: string) => ({
  pageId,
  url: `http://localhost/${pageId}`,
  title: `Query ${pageId}`,
  reportedAt: 4_000,
  plugins: [
    {
      id: 'query',
      version: '5.0.0',
      title: 'Query cache',
      status: 'running',
      view: {
        sections: [{ kind: 'text', title: 'Note', text: 'Two queries' }],
        actions: [{ name: 'refetch', label: 'Refetch all' }],
      },
      actions: ['refetch'],
    },
  ],
});

const actionCalls = (calls: { name: string; args: unknown[] }[]) =>
  calls.filter((call) => call.name === 'request-plugin-action').map((call) => call.args[0]);

describe('the Plugins tab confirm prompt', () => {
  it('drops the pending confirm and the old result when another plugin is picked', async () => {
    const { fixture, calls } = await mount({
      pages: { p1: page('p1'), p2: queryPage('p2') },
      server: [],
    });
    button(fixture, 'Travel store').click();
    await settle(fixture);
    fixture.componentInstance.result.set('Done.');
    button(fixture, 'Clear saved destinations').click();
    await settle(fixture);
    expect(text(fixture)).toContain('Remove every saved destination from the store?');

    button(fixture, 'Query cache').click();
    await settle(fixture);
    expect(text(fixture)).not.toContain('Remove every saved destination from the store?');
    expect(() => button(fixture, 'Clear saved destinations')).toThrow();
    expect(host(fixture).querySelector('[role="status"].result')?.textContent).toBe('');

    // Going back does not bring the old prompt back.
    button(fixture, 'Travel store').click();
    await settle(fixture);
    expect(text(fixture)).not.toContain('Remove every saved destination from the store?');
    expect(actionCalls(calls)).toEqual([]);
  });

  it('drops the pending confirm when another page is picked', async () => {
    const { fixture, calls } = await mount({
      pages: { p1: page('p1'), p3: { ...page('p3'), reportedAt: 1 } },
      server: [],
    });
    button(fixture, 'Clear saved destinations').click();
    await settle(fixture);
    expect(text(fixture)).toContain('Remove every saved destination from the store?');

    fixture.componentInstance.pageId.set('p3');
    await settle(fixture);
    expect(text(fixture)).not.toContain('Remove every saved destination from the store?');
    expect(actionCalls(calls)).toEqual([]);
  });

  it('never sends an action the picked plugin does not have', async () => {
    const { fixture, calls } = await mount({
      pages: { p1: page('p1'), p2: queryPage('p2') },
      server: [],
    });
    expect(fixture.componentInstance.pluginId()).toBe('query');
    await fixture.componentInstance.run('unsave-all');
    expect(actionCalls(calls)).toEqual([]);
    await fixture.componentInstance.run('refetch');
    expect(actionCalls(calls)).toEqual([{ pageId: 'p2', pluginId: 'query', action: 'refetch' }]);
  });
});
