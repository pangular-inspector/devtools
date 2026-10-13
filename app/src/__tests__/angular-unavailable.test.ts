import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { angularPageFor } from '../angular-pages';
import { DiInspector } from '../pages/di-inspector';
import { ForBlocksSection } from '../pages/for-blocks-section';
import { SignalInspector } from '../pages/signal-inspector';
import { AngularUnavailable } from '../ui/angular-unavailable';

const ANGULAR_15 = {
  pageId: 'p1',
  version: '15.2.10',
  reportedAt: 1,
  capabilities: {
    debugApi: true,
    injectorProviders: false,
    injectorMetadata: false,
    signalGraph: false,
    deferBlocks: false,
    forBlocks: false,
    profiler: false,
  },
};

/** A client whose shared states hold `states`, and whose RPC calls answer with an empty list. */
function client(states: Record<string, unknown>) {
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => states[name] ?? null, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

describe('the Angular unavailable note', () => {
  async function note(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(AngularUnavailable);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await settle(fixture);
    return fixture.nativeElement as HTMLElement;
  }

  it('names the missing part, its version and the page version, as a status', async () => {
    const host = await note({ page: ANGULAR_15, capability: 'signalGraph' });
    const status = host.querySelector('[role="status"]');
    expect(status?.querySelector('.title')?.textContent).toBe('Not available on Angular 15.2');
    expect(status?.textContent).toContain(
      'The live signal graph needs Angular 20.1 or later; this page runs Angular 15.2.',
    );
    expect(status?.querySelector('a')?.getAttribute('href')).toContain(
      'supported-angular-versions',
    );
  });

  it('shows nothing while the page has the part, or never said', async () => {
    const has = { ...ANGULAR_15, capabilities: { signalGraph: true } };
    expect((await note({ page: has, capability: 'signalGraph' })).textContent?.trim()).toBe('');
    expect((await note({ page: null, capability: 'signalGraph' })).textContent?.trim()).toBe('');
  });

  it('shows when the part is there in a form too old to use', async () => {
    const page = { version: '19.2.25', capabilities: { signalGraph: true } };
    const host = await note({ page, capability: 'signalGraph', missing: true });
    expect(host.textContent).toContain('needs Angular 20.1 or later; this page runs Angular 19.2.');
  });

  it('picks the shown page, else the newest', () => {
    const pages = { p1: ANGULAR_15, p2: { ...ANGULAR_15, pageId: 'p2', reportedAt: 5 } };
    expect(angularPageFor(pages, 'p1')?.pageId).toBe('p1');
    expect(angularPageFor(pages, null)?.pageId).toBe('p2');
    expect(angularPageFor(pages, 'gone')).toBeNull();
  });
});

describe('inspector views on Angular 15', () => {
  it('Signals says why there is no live graph', async () => {
    const fixture = TestBed.createComponent(SignalInspector);
    document.body.append(fixture.nativeElement);
    fixture.componentRef.setInput(
      'rpc',
      client({
        'signal-graph': { graph: null, pages: {} },
        'page-angular': { pages: { p1: ANGULAR_15 } },
      }),
    );
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Not available on Angular 15.2');
    expect(host.textContent).toContain('The live signal graph needs Angular 20.1 or later');
  });

  it('Injectors marks the tree as reduced', async () => {
    const fixture = TestBed.createComponent(DiInspector);
    document.body.append(fixture.nativeElement);
    fixture.componentRef.setInput(
      'rpc',
      client({
        'injector-tree': {
          roots: [],
          environment: [],
          pages: {
            p1: {
              pageId: 'p1',
              reportedAt: 1,
              environment: [],
              roots: [
                {
                  injector: { id: 'inj-1', type: 'element', name: 'app-root', providerCount: 0 },
                  providers: [],
                  children: [],
                },
              ],
            },
          },
        },
        'page-angular': { pages: { p1: ANGULAR_15 } },
      }),
    );
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain(
      'The full injector tree needs Angular 17.0 or later; this page runs Angular 15.2.',
    );
    expect(host.textContent).toContain('This tree shows the element injectors the page reports');
  });

  it('@for blocks names the version that lists them', async () => {
    const fixture = TestBed.createComponent(ForBlocksSection);
    fixture.componentRef.setInput('supported', false);
    fixture.componentRef.setInput('angular', { ...ANGULAR_15, version: '21.0.9' });
    await settle(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Listing @for blocks needs Angular 22.0 or later; this page runs Angular 21.0.',
    );
  });
});
