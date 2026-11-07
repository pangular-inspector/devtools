import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RouteTree } from '../pages/route-tree';
import type { RoutePreview, RouterPage } from '../pages/router-types';

type Call = (name: string, arg: unknown) => Promise<unknown>;

function fakeClient(call: Call): DevframeRpcClient {
  const rpc = { call, callEvent: () => Promise.resolve() };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const page: RouterPage = {
  pageId: 'p1',
  reportedAt: 1,
  snapshot: null,
  navigations: [],
  config: [{ id: '0', path: 'account', fullPath: '/account', kind: 'component', component: 'A' }],
};

const preview: RoutePreview = {
  url: '/old',
  finalUrl: '/account/7',
  matched: true,
  hops: [{ from: '/old', to: '/account/7', route: '/old' }],
  chain: [
    { path: '/account', active: true },
    { path: '/account/:id', component: 'AccountPage', source: 'src/app/app.routes.ts:4' },
  ],
  params: { id: '7' },
  steps: [
    { phase: 'canActivateChild and canActivate', items: ['canActivate ownerGuard @ /account/:id'] },
    { phase: 'Renders', items: ['AccountPage for /account/:id'] },
  ],
  renderMode: { mode: 'Server', path: '**', file: 'src/app/app.routes.server.ts' },
  notes: [],
  nearest: [],
};

function mount(call: Call) {
  const fixture = TestBed.createComponent(RouteTree);
  fixture.componentRef.setInput('page', page);
  fixture.componentRef.setInput('rpc', fakeClient(call));
  document.body.append(fixture.nativeElement as HTMLElement);
  return fixture;
}

function el(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function typeUrl(fixture: ComponentFixture<unknown>, url: string) {
  const input = el(fixture).querySelector<HTMLInputElement>('#test-url')!;
  input.value = url;
  input.dispatchEvent(new Event('input'));
}

function whatHappens(fixture: ComponentFixture<unknown>) {
  Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === 'What happens')!
    .click();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RouteTree What happens', () => {
  it('shows the redirects, chain, steps, source and render mode for a URL', async () => {
    const calls: unknown[] = [];
    const fixture = mount((name, arg) => {
      calls.push([name, arg]);
      return Promise.resolve(preview);
    });
    await settle(fixture);
    typeUrl(fixture, '/old');
    whatHappens(fixture);
    await settle(fixture);
    expect(calls).toEqual([['router-preview', { pageId: 'p1', url: '/old' }]]);
    const card = el(fixture).querySelector('app-route-preview')!;
    const text = card.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('What happens if you go to /old');
    expect(text).toContain('Redirect /old');
    expect(text).toContain('Params: id=7');
    expect(text).toContain('canActivate ownerGuard @ /account/:id');
    expect(text).toContain('src/app/app.routes.ts:4');
    expect(text).toContain('Render mode Server');
    expect(el(fixture).querySelector('p.message[role="status"]')?.textContent).toContain(
      'Matches /account then /account/:id, 2 steps listed.',
    );

    typeUrl(fixture, '/other');
    await settle(fixture);
    expect(el(fixture).querySelector('app-route-preview')).toBeNull();
  });

  it('says why when there is no preview', async () => {
    const fixture = mount(() => Promise.resolve({ error: 'Give a URL, such as /users/42.' }));
    await settle(fixture);
    typeUrl(fixture, '/x');
    whatHappens(fixture);
    await settle(fixture);
    expect(el(fixture).querySelector('app-route-preview')).toBeNull();
    expect(el(fixture).querySelector('p.message')?.textContent).toContain('Give a URL');
  });
});
