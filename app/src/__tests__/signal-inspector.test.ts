import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { SignalInspector } from '../pages/signal-inspector';

function fakeClient(graph: Record<string, unknown>): DevframeRpcClient {
  const state = (value: unknown) => Promise.resolve({ value: () => value, on: () => () => {} });
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) => state(name === 'signal-graph' ? { graph } : { pages: {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function render(graph: Record<string, unknown>) {
  const fixture = TestBed.createComponent(SignalInspector);
  fixture.componentRef.setInput('rpc', fakeClient(graph));
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return fixture;
}

function notices(fixture: ComponentFixture<unknown>): string[] {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('[role="status"]'),
    (el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

const graph = {
  nodes: [{ id: '1', kind: 'signal', label: 'query', epoch: 1, value: 'x' }],
  edges: [],
  componentSelector: 'app-root',
  component: { id: 'c1', name: 'App', tag: 'app-root', path: 'app-root' },
};

describe('SignalInspector', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('says when the write hook did not load', async () => {
    const fixture = await render({ ...graph, writeHook: false });
    expect(notices(fixture)).toContain(
      'The signal write hook did not load. Value history shows sampled values only, with no exact set entries.',
    );
  });

  it('shows no write hook notice when the hook loaded', async () => {
    const fixture = await render(graph);
    expect(notices(fixture).some((text) => text.includes('write hook'))).toBe(false);
  });

  it('stays on the first page it follows when a second tab reports later', async () => {
    const listeners = new Set<(value: unknown) => void>();
    const owned = (pageId: string, id: string) => ({
      ...graph,
      pageId,
      component: { ...graph.component, id },
    });
    const a = owned('A', 'cA');
    const b = owned('B', 'cB');
    const state = (value: unknown) =>
      Promise.resolve({
        value: () => value,
        on: (_event: string, listener: (value: unknown) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      });
    const rpc = {
      call: () => Promise.resolve([]),
      callEvent: () => Promise.resolve(),
      sharedState: (name: string) =>
        state(name === 'signal-graph' ? { graph: a, pages: { A: a } } : { pages: {} }),
    };
    const fixture = TestBed.createComponent(SignalInspector);
    fixture.componentRef.setInput('rpc', {
      connectionMeta: {},
      scope: () => ({ rpc }),
    } as unknown as DevframeRpcClient);
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    expect(fixture.componentInstance.graph()?.pageId).toBe('A');

    for (const listener of listeners) listener({ graph: b, pages: { A: a, B: b } });
    expect(fixture.componentInstance.graph()?.pageId).toBe('A');

    for (const listener of listeners) listener({ graph: b, pages: { B: b } });
    expect(fixture.componentInstance.graph()?.pageId).toBe('B');
  });

  describe('page picker', () => {
    const owned = (pageId: string, id: string, label: string) => ({
      ...graph,
      pageId,
      nodes: [{ id: '1', kind: 'signal', label, epoch: 1, value: 'x' }],
      component: { ...graph.component, id },
    });
    const a = owned('A', 'cA', 'fromA');
    const b = owned('B', 'cB', 'fromB');
    const trees = {
      pages: {
        A: {
          title: 'Tab A',
          url: '/a',
          reportedAt: 1,
          roots: [{ id: 'cA', name: 'AppA', tag: 'app-a', children: [] }],
        },
        B: {
          title: 'Tab B',
          url: '/b',
          reportedAt: 2,
          roots: [{ id: 'cB', name: 'AppB', tag: 'app-b', children: [] }],
        },
      },
    };

    async function renderPages(first: unknown) {
      const listeners = new Set<(value: unknown) => void>();
      const calls: { name: string; args: unknown }[] = [];
      const rpc = {
        call: (name: string, args: unknown) => {
          calls.push({ name, args });
          return Promise.resolve([]);
        },
        callEvent: () => Promise.resolve(),
        sharedState: (name: string) =>
          Promise.resolve({
            value: () => (name === 'signal-graph' ? first : trees),
            on: (_event: string, listener: (value: unknown) => void) => {
              if (name === 'signal-graph') listeners.add(listener);
              return () => listeners.delete(listener);
            },
          }),
      };
      const fixture = TestBed.createComponent(SignalInspector);
      fixture.componentRef.setInput('rpc', {
        connectionMeta: {},
        scope: () => ({ rpc }),
      } as unknown as DevframeRpcClient);
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
      const push = async (value: unknown) => {
        for (const listener of listeners) listener(value);
        await fixture.whenStable();
      };
      return { fixture, calls, push };
    }

    function trigger(fixture: ComponentFixture<unknown>, labelId: string) {
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        `[aria-labelledby="${labelId}"][role="combobox"]`,
      );
    }

    async function choose(fixture: ComponentFixture<unknown>, labelId: string, label: string) {
      trigger(fixture, labelId)!.click();
      await fixture.whenStable();
      const option = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="option"]'),
      ).find((el) => el.textContent?.includes(label));
      expect(option).toBeDefined();
      option!.click();
      await fixture.whenStable();
    }

    function optionLabels(fixture: ComponentFixture<SignalInspector>) {
      return fixture.componentInstance.componentOptions().map((o) => o.label);
    }

    it('shows no page picker when one page reports', async () => {
      const { fixture } = await renderPages({ graph: a, pages: { A: a } });
      expect(trigger(fixture, 'signals-page-label')).toBeNull();
      expect(fixture.componentInstance.graph()?.pageId).toBe('A');
    });

    it('switches the graph and the Graph of options to the chosen page', async () => {
      const { fixture } = await renderPages({ graph: b, pages: { A: a, B: b } });
      const host = fixture.nativeElement as HTMLElement;
      expect(trigger(fixture, 'signals-page-label')?.textContent).toContain('Tab B');
      expect(host.textContent).toContain('fromB');
      expect(optionLabels(fixture)).toContain('AppB');

      await choose(fixture, 'signals-page-label', 'Tab A');
      expect(fixture.componentInstance.graph()?.pageId).toBe('A');
      expect(host.textContent).toContain('fromA');
      expect(host.textContent).not.toContain('fromB');
      expect(optionLabels(fixture)).toContain('AppA');
      expect(optionLabels(fixture)).not.toContain('AppB');
      expect(notices(fixture)).toContain('Showing the signal graph of Tab A.');
    });

    it('sends select-signal-target with the chosen page id and keeps a pick per page', async () => {
      const { fixture, calls } = await renderPages({ graph: b, pages: { A: a, B: b } });
      await choose(fixture, 'signals-page-label', 'Tab A');
      await choose(fixture, 'signals-component-label', 'AppA');
      expect(calls.filter((c) => c.name === 'select-signal-target')).toEqual([
        { name: 'select-signal-target', args: { pageId: 'A', id: 'cA' } },
      ]);

      await choose(fixture, 'signals-page-label', 'Tab B');
      expect(fixture.componentInstance.pickerValue()).toBe('follow');
      await choose(fixture, 'signals-page-label', 'Tab A');
      expect(fixture.componentInstance.pickerValue()).toBe('cA');
    });

    it('keeps the chosen page when another page reports, and falls back when it closes', async () => {
      const { fixture, push } = await renderPages({ graph: b, pages: { A: a, B: b } });
      await choose(fixture, 'signals-page-label', 'Tab A');
      await push({ graph: b, pages: { A: a, B: b } });
      expect(fixture.componentInstance.graph()?.pageId).toBe('A');

      await push({ graph: b, pages: { B: b } });
      expect(fixture.componentInstance.graph()?.pageId).toBe('B');
      expect(trigger(fixture, 'signals-page-label')).toBeNull();
      expect(notices(fixture)).toContain('Tab A closed, so this shows another page.');
    });
  });

  it('offers Clear filters when a filter hides the only resource of a resource-only graph', async () => {
    const fixture = await render({
      ...graph,
      resources: [{ id: 'r1', name: 'user', named: true, status: 'resolved', nodeIds: ['1'] }],
    });
    const host = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.filter.set('zzz');
    await fixture.whenStable();
    expect(host.textContent).toContain('No signals match.');
    expect(host.textContent).not.toContain('No signals in this graph.');
    const clear = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Clear filters',
    );
    expect(clear).toBeDefined();
    clear!.click();
    await fixture.whenStable();
    expect(host.textContent).toContain('user');
  });
});
