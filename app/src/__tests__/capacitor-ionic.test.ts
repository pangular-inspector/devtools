import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CapacitorIonic, directionText, type IonicPage } from '../pages/capacitor-ionic';

function ionicPage(pageId = 'tab1'): IonicPage {
  return {
    pageId,
    url: '/tabs/tab1/detail',
    title: 'Ionic app',
    framework: '@ionic/angular',
    mode: 'ios',
    reportedAt: 1,
    outlets: [
      {
        id: 'c1-1',
        name: 'primary',
        tabs: '/tabs/tab1',
        source: 'angular',
        canGoBack: true,
        direction: 'back',
        directionSource: 'event',
        animated: true,
        pages: [
          {
            component: 'HomePage',
            tag: 'app-home',
            url: '/tabs/tab1',
            active: true,
            elementId: 'e1',
          },
          {
            component: 'DetailPage',
            tag: 'app-detail',
            url: '/tabs/tab1/detail',
            active: false,
            elementId: 'e2',
          },
        ],
      },
    ],
  };
}

function fakeClient(pages: IonicPage[]) {
  const calls: { name: string; arg: unknown }[] = [];
  const rpc = {
    call: (name: string, arg: unknown) => {
      calls.push({ name, arg });
      return Promise.resolve(null);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () =>
          name === 'ionic' ? { pages: Object.fromEntries(pages.map((p) => [p.pageId, p])) } : {},
        on: () => () => {},
      }),
  };
  const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { client, calls };
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

describe('CapacitorIonic', () => {
  it('lists the page stack of each outlet with the active page and the last direction', async () => {
    const { client, calls } = fakeClient([ionicPage()]);
    const fixture = TestBed.createComponent(CapacitorIonic);
    fixture.componentRef.setInput('rpc', client);
    fixture.componentRef.setInput('pageId', 'tab1');
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h2')?.textContent).toBe('Ionic page stacks');
    const rows = Array.from(host.querySelectorAll<HTMLButtonElement>('.stack-page'));
    expect(rows.map((row) => row.querySelector('.component')?.textContent)).toEqual([
      'HomePage',
      'DetailPage',
    ]);
    expect(rows[0].getAttribute('aria-current')).toBe('page');
    expect(rows[1].getAttribute('aria-current')).toBeNull();
    expect(host.textContent).toContain('/tabs/tab1');
    expect(host.textContent).toContain('Back');

    rows[1].dispatchEvent(new Event('focus'));
    expect(calls.at(-1)).toEqual({
      name: 'request-page-highlight',
      arg: { pageId: 'tab1', id: 'e2', reveal: false },
    });
    rows[1].dispatchEvent(new Event('blur'));
    expect(calls.at(-1)).toEqual({ name: 'request-page-highlight', arg: null });
  });

  it('shows nothing for a page that does not use Ionic', async () => {
    const { client } = fakeClient([ionicPage('other')]);
    const fixture = TestBed.createComponent(CapacitorIonic);
    fixture.componentRef.setInput('rpc', client);
    fixture.componentRef.setInput('pageId', 'tab1');
    await settle(fixture);
    expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();
  });

  it('words the direction with its source', () => {
    const outlet = ionicPage().outlets[0];
    expect(directionText({ ...outlet, direction: undefined })).toBe('Not seen yet');
    expect(directionText({ ...outlet, directionSource: 'inferred', direction: 'forward' })).toBe(
      'Forward (from the stack)',
    );
    expect(directionText({ ...outlet, direction: 'root', tabSwitch: true, animated: false })).toBe(
      'Root (tab switch, no animation)',
    );
  });
});
