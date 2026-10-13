import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  StartupSection,
  formatMs,
  milestones,
  startupPages,
  type PanelStartupPage,
} from '../pages/startup-section';

const report = (pageId: string, extra: Partial<PanelStartupPage> = {}): PanelStartupPage => ({
  pageId,
  reportedAt: 5_000,
  angularVersion: '22.1.7',
  navigation: { domContentLoaded: 120, firstContentfulPaint: 300 },
  angularStart: { at: 140, source: 'hook' },
  bootstrapComponent: { start: 180, end: 230 },
  firstStable: { at: 640, exact: true },
  overlayStart: 900,
  hook: true,
  providers: {
    status: 'measured',
    count: 42,
    totalSelfMs: 61.5,
    slowest: [{ name: 'TripService', count: 1, ms: 30, selfMs: 24.5, firstAt: 200 }],
  },
  ...extra,
});

function fakeClient(value: unknown) {
  const rpc = {
    call: () => Promise.resolve(null),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => (name === 'startup' ? value : null), on: () => () => {} }),
  };
  return { scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function mount(value: unknown, pageId: string | null = null) {
  const fixture = TestBed.createComponent(StartupSection);
  fixture.componentRef.setInput('rpc', fakeClient(value));
  fixture.componentRef.setInput('pageId', pageId);
  document.body.append(fixture.nativeElement);
  await settle(fixture);
  return fixture;
}

const text = (fixture: ComponentFixture<unknown>) =>
  ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('startup timing helpers', () => {
  it('orders the milestones and marks an upper bound', () => {
    const steps = milestones(report('p1', { firstStable: { at: 950, exact: false } }));
    expect(steps.map((step) => step.label)).toEqual([
      'DOM content loaded',
      'Angular started',
      'Root component created',
      'First contentful paint',
      'Overlay started',
      'First stable, at the latest',
    ]);
    expect(formatMs(24.54)).toBe('24.5 ms');
    expect(formatMs(1250)).toBe('1.25 s');
    expect(startupPages({ pages: { a: report('a', { reportedAt: 1 }), b: report('b') } })).toEqual([
      expect.objectContaining({ pageId: 'b' }),
      expect.objectContaining({ pageId: 'a' }),
    ]);
  });
});

describe('the startup section', () => {
  it('stays hidden while no page reports', async () => {
    const fixture = await mount({ pages: {} });
    expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();
  });

  it('shows the milestones, the time to stable and the slowest providers of the shown page', async () => {
    const fixture = await mount(
      { pages: { p1: report('p1'), p2: report('p2', { angularVersion: '21.0.0' }) } },
      'p1',
    );
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h2')?.textContent).toBe('Startup');
    expect(text(fixture)).toContain("(Angular 22.1.7): 500 ms from Angular's start to stable.");
    expect(text(fixture)).toContain('Root component created');
    expect(text(fixture)).toContain('42 provider instances, 61.5 ms of construction');
    const rows = [...root.querySelectorAll('[aria-label="Slowest providers"] tbody tr')];
    expect(
      rows.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim())),
    ).toEqual([['TripService', '24.5 ms', '30 ms', '1']]);
    for (const region of root.querySelectorAll('[role="region"]')) {
      expect(region.getAttribute('tabindex')).toBe('0');
    }
  });

  it('says how to time providers without the startup hook', async () => {
    const fixture = await mount({
      pages: {
        p1: report('p1', {
          hook: false,
          firstStable: { at: 950, exact: false },
          providers: { status: 'needs-hook', count: 0, totalSelfMs: 0, slowest: [] },
        }),
      },
    });
    expect(text(fixture)).toContain('at most 810 ms');
    expect(text(fixture)).toContain('@pangular-inspector/devtools/startup-hook');
  });

  it('drops a late answer from the client it had before the rpc input changed', async () => {
    let answerOld: (state: unknown) => void = () => {};
    const slowRpc = {
      call: () => Promise.resolve(null),
      sharedState: () =>
        new Promise((resolve) => {
          answerOld = resolve;
        }),
    };
    const oldClient = { scope: () => ({ rpc: slowRpc }) } as unknown as DevframeRpcClient;
    const fixture = TestBed.createComponent(StartupSection);
    fixture.componentRef.setInput('rpc', oldClient);
    fixture.componentRef.setInput('pageId', null);
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient({ pages: { fresh: report('fresh', { angularVersion: '22.1.7' }) } }),
    );
    await settle(fixture);
    answerOld({
      value: () => ({ pages: { stale: report('stale', { angularVersion: '19.0.0' }) } }),
      on: () => () => {},
    });
    await settle(fixture);
    expect(text(fixture)).toContain('Angular 22.1.7');
    expect(text(fixture)).not.toContain('19.0.0');
  });
});
