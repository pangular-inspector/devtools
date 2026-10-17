import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RouteTimeline } from '../pages/route-timeline';
import type { RouterPage } from '../pages/router-types';

function fakeClient(): DevframeRpcClient {
  const rpc = { call: () => Promise.resolve(undefined), callEvent: () => Promise.resolve() };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RouteTimeline phase colors', () => {
  it('paints the bar segments and the legend with the --phase-<name> tokens', async () => {
    const page: RouterPage = {
      pageId: 'p1',
      reportedAt: 1,
      snapshot: null,
      navigations: [
        {
          id: 1,
          url: '/a',
          trigger: 'imperative',
          startedAt: 1,
          endedAt: 41,
          outcome: 'succeeded',
          phases: { recognize: 10, guards: 10, resolve: 10, activate: 10, total: 40 },
        },
      ],
    };
    const fixture = TestBed.createComponent(RouteTimeline);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('rpc', fakeClient());
    const root = fixture.nativeElement as HTMLElement;
    document.body.append(root);
    await settle(fixture);

    const backgrounds = (selector: string) =>
      [...root.querySelectorAll<HTMLElement>(selector)].map((node) => node.style.background);
    const expected = ['recognize', 'guards', 'resolve', 'activate'].map(
      (phase) => `var(--phase-${phase})`,
    );
    expect(backgrounds('.bar span')).toEqual(expected);
    expect(backgrounds('.legend i')).toEqual(expected);
  });
});
