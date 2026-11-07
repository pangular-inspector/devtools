import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { scopeToPage } from '../page-id';
import { PipesInspector } from '../pages/pipes-inspector';
import { ComponentPipesSection, templatePipes } from '../pages/component-pipes-section';

const source = (name: string, className: string) => ({
  name,
  className,
  file: `src/${name}.pipe.ts`,
  line: 3,
  isStandalone: true,
  isPure: true,
});

const SOURCE = [
  source('alpha', 'AlphaPipe'),
  source('beta', 'BetaPipe'),
  source('gamma', 'GammaPipe'),
];

const live = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  className: `${name}Pipe`,
  isPure: true,
  instanceCount: 1,
  components: [{ name: 'Header', count: 1 }],
  ...extra,
});

const SNAPSHOT = {
  pipes: [
    live('alpha', { call: { callCount: 3, totalMs: 40 } }),
    live('beta', { call: { callCount: 90, totalMs: 2 }, churn: { streak: 24, detectedAt: 1 } }),
    live('gamma', { components: [{ name: 'Footer', count: 2 }] }),
  ],
  async: [],
  instrumented: ['p1'],
};

function client(snapshot: unknown) {
  const rpc = {
    call: (name: string) => Promise.resolve(name === 'get-pipes' ? SOURCE : []),
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => snapshot, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: { whenStable(): Promise<unknown> }) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function rowNames(host: HTMLElement) {
  return Array.from(host.querySelectorAll('[data-pipe-row] .name'), (n) => n.textContent);
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('hot pipes', () => {
  afterEach(() => {
    scopeToPage(null);
    document.body.innerHTML = '';
  });

  it('sorts by calls or time, and shows only the pipes called while recording', async () => {
    const fixture = TestBed.createComponent(PipesInspector);
    document.body.append(fixture.nativeElement);
    fixture.componentRef.setInput('rpc', client(SNAPSHOT));
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(rowNames(host)).toEqual(['alpha', 'beta', 'gamma']);
    fixture.componentInstance.sort.set('calls');
    await settle(fixture);
    expect(rowNames(host)).toEqual(['beta', 'alpha', 'gamma']);
    fixture.componentInstance.sort.set('time');
    await settle(fixture);
    expect(rowNames(host)).toEqual(['alpha', 'beta', 'gamma']);
    fixture.componentInstance.kind.set('called');
    await settle(fixture);
    expect(rowNames(host)).toEqual(['alpha', 'beta']);

    const beta = host.querySelectorAll('[data-pipe-row]')[1];
    expect(text(beta)).toContain('churning');
    expect(text(beta)).toContain('90 calls');
    (beta as HTMLButtonElement).click();
    await settle(fixture);
    expect(text(host.querySelector('#pipe-detail'))).toContain('ran 24 times in a row');
  });

  it('selects the pipe another tab asks for', async () => {
    const fixture = TestBed.createComponent(PipesInspector);
    document.body.append(fixture.nativeElement);
    let handled = 0;
    fixture.componentInstance.focusHandled.subscribe(() => handled++);
    fixture.componentRef.setInput('rpc', client(SNAPSHOT));
    fixture.componentRef.setInput('focus', 'gamma');
    await settle(fixture);
    expect(fixture.componentInstance.selected()?.name).toBe('gamma');
    expect(handled).toBe(1);
  });
});

describe('pipes in a component template', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists the pipes one component class uses, from its page', () => {
    const snapshot = {
      ...SNAPSHOT,
      pages: [
        { pageId: 'p2', pipes: [live('delta', { components: [{ name: 'Header', count: 4 }] })] },
      ],
    };
    expect(templatePipes(snapshot, undefined, 'Header').map((r) => r.name)).toEqual([
      'alpha',
      'beta',
    ]);
    expect(templatePipes(snapshot, 'p2', 'Header')).toEqual([
      { name: 'delta', isPure: true, uses: 4, churn: false, stale: false },
    ]);
    expect(templatePipes(snapshot, undefined, 'Nobody')).toEqual([]);
  });

  it('renders the list and opens a pipe in the Pipes tab', async () => {
    const fixture = TestBed.createComponent(ComponentPipesSection);
    document.body.append(fixture.nativeElement);
    const shown: string[] = [];
    fixture.componentInstance.showPipe.subscribe((name) => shown.push(name));
    fixture.componentRef.setInput('rpc', client(SNAPSHOT));
    fixture.componentRef.setInput('component', 'Header');
    fixture.componentRef.setInput('canShowPipes', true);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(text(host.querySelector('h3'))).toBe('Pipes in template 2');
    const buttons = host.querySelectorAll<HTMLButtonElement>('button.pipe');
    expect(text(buttons[1])).toContain('churning');
    buttons[0].click();
    expect(shown).toEqual(['alpha']);
    fixture.componentRef.setInput('component', 'Nobody');
    await settle(fixture);
    expect(text(host)).toContain('No pipe is in use');
  });
});
