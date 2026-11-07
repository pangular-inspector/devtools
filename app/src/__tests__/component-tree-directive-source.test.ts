import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

const directive = (className: string, file: string) => ({
  selector: '[appTooltip]',
  className,
  kind: 'directive',
  file,
  line: 7,
  inputs: [],
  outputs: [],
  isStandalone: true,
});

function fakeClient(components: unknown[]): DevframeRpcClient {
  const page = {
    pageId: 'p1',
    roots: [
      {
        id: 'c1',
        name: 'Card',
        tag: 'app-card',
        children: [
          {
            id: 'h1',
            name: 'button',
            tag: 'button',
            kind: 'directive',
            directives: ['Tooltip', 'Ripple'],
            children: [],
          },
        ],
      },
    ],
    count: 1,
    directiveHostCount: 1,
    detail: null,
    reportedAt: 1000,
  };
  const rpc = {
    call: (name: string) => Promise.resolve(name === 'get-components' ? components : []),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? { pages: { p1: page } } : null),
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

describe('directive sources', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('marks a directive file found by class name as likely, and names several files', async () => {
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient([
        directive('Tooltip', 'src/app/tooltip.directive.ts'),
        directive('Ripple', 'src/app/a/ripple.ts'),
        directive('Ripple', 'src/app/b/ripple.ts'),
      ]),
    );
    await settle(fixture);
    fixture.componentInstance.select('h1');
    await settle(fixture);
    const chips = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.detail .chip'),
    ).map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim());
    expect(chips[0]).toContain('Tooltip');
    expect(chips[0]).toContain('Likely');
    expect(chips[0]).toContain('tooltip.directive.ts');
    expect(chips[1]).toContain('2 source files define Ripple');
  });
});
