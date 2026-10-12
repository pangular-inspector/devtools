import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DiInspector } from '../pages/di-inspector';

const provider = (token: string, framework = false) => ({
  token,
  type: 'class',
  isViewProvider: false,
  ...(framework ? { framework: true } : {}),
});

const tree = {
  pages: {
    p1: {
      pageId: 'p1',
      reportedAt: 1,
      roots: [
        {
          injector: {
            id: 'inj-1',
            type: 'element',
            name: 'app-root',
            providerCount: 0,
            component: 'App',
            componentId: 'c1',
          },
          providers: [],
          children: [],
        },
      ],
      environment: [
        {
          injector: {
            id: 'inj-p',
            type: 'environment',
            name: 'Platform',
            providerCount: 1,
            framework: true,
          },
          providers: [provider('PlatformLocation', true)],
          children: [
            {
              injector: { id: 'inj-r', type: 'environment', name: 'Root', providerCount: 3 },
              providers: [
                provider('ApplicationRef', true),
                provider('NgZone', true),
                provider('TripStore'),
              ],
              children: [],
            },
          ],
        },
      ],
    },
  },
};

const calls: { name: string; payload: unknown }[] = [];

function client(): DevframeRpcClient {
  const rpc = {
    call: (name: string, payload: unknown) => {
      calls.push({ name, payload });
      if (name === 'request-console-global') {
        return Promise.resolve({ ok: true, message: 'Logged TripStore in the page console.' });
      }
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => tree, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render() {
  const fixture = TestBed.createComponent(DiInspector);
  fixture.componentRef.setInput('rpc', client());
  document.body.append(fixture.nativeElement);
  await settle(fixture);
  return fixture;
}

const host = (fixture: ComponentFixture<DiInspector>) => fixture.nativeElement as HTMLElement;
const checkbox = (fixture: ComponentFixture<DiInspector>, label: string) =>
  [...host(fixture).querySelectorAll('label.checkbox')]
    .find((l) => l.textContent?.trim() === label)!
    .querySelector('input')!;
const rowNames = (fixture: ComponentFixture<DiInspector>) =>
  [...host(fixture).querySelectorAll('.row .name')].map((n) => n.textContent?.trim());
const providerTokens = (fixture: ComponentFixture<DiInspector>) =>
  [...host(fixture).querySelectorAll('.providers .provider .token')].map((n) =>
    n.textContent?.trim(),
  );

describe('Hide framework in the Injectors tab', () => {
  afterEach(() => {
    calls.length = 0;
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it("hides Angular's own injectors and providers, says how many, and remembers it", async () => {
    const fixture = await render();
    fixture.componentInstance.setView('environment');
    await settle(fixture);
    expect(rowNames(fixture)).toEqual(['Platform', 'Root']);

    checkbox(fixture, 'Hide framework').click();
    await settle(fixture);
    // Root moves up to take the Platform injector's place.
    expect(rowNames(fixture)).toEqual(['Root']);
    expect(host(fixture).querySelector('.framework-hidden')?.textContent?.trim()).toBe(
      '1 injector and 2 providers hidden',
    );
    expect(localStorage.getItem('pangular-pref:injectors.hideFramework')).toBe('true');

    fixture.componentInstance.select('inj-r');
    await settle(fixture);
    expect(providerTokens(fixture)).toEqual(['TripStore']);
    expect(host(fixture).querySelector('.framework-note')?.textContent).toMatch(
      /2 framework providers hidden/,
    );
    const pill = host(fixture).querySelector('.row[data-id="inj-r"] .provides');
    expect(pill?.textContent?.replace(/\s+/g, ' ').trim()).toBe('provides 1');

    // A second visit starts with the saved choice.
    const again = await render();
    expect(again.componentInstance.hideFramework()).toBe(true);
  });

  it('shows the framework providers again from the note', async () => {
    localStorage.setItem('pangular-pref:injectors.hideFramework', 'true');
    const fixture = await render();
    fixture.componentInstance.setView('environment');
    fixture.componentInstance.select('inj-r');
    await settle(fixture);
    [...host(fixture).querySelectorAll<HTMLButtonElement>('.framework-note button')][0]!.click();
    await settle(fixture);
    expect(providerTokens(fixture)).toEqual(['ApplicationRef', 'NgZone', 'TripStore']);
    expect(host(fixture).querySelectorAll('.providers .flag').length).toBeGreaterThan(0);
    expect(localStorage.getItem('pangular-pref:injectors.hideFramework')).toBe('false');
  });

  it('turns the filter off for now to reveal a hidden injector, without saving that', async () => {
    localStorage.setItem('pangular-pref:injectors.hideFramework', 'true');
    const fixture = await render();
    fixture.componentInstance.reveal('inj-p');
    await settle(fixture);
    expect(fixture.componentInstance.hideFramework()).toBe(false);
    expect(fixture.componentInstance.selectedId()).toBe('inj-p');
    expect(localStorage.getItem('pangular-pref:injectors.hideFramework')).toBe('true');
  });
});

describe('Log to console for a provider', () => {
  afterEach(() => {
    calls.length = 0;
    document.body.innerHTML = '';
  });

  it("asks the shown page to log the provider's value and shows only the message", async () => {
    const fixture = await render();
    fixture.componentInstance.setView('environment');
    fixture.componentInstance.select('inj-r');
    await settle(fixture);
    const log = [...host(fixture).querySelectorAll<HTMLButtonElement>('button.log')].find((b) =>
      b.textContent?.includes('TripStore'),
    )!;
    expect(log.textContent?.replace(/\s+/g, ' ').trim()).toBe('Log to console : TripStore');
    log.click();
    await settle(fixture);
    expect(calls.find((c) => c.name === 'request-console-global')?.payload).toEqual({
      pageId: 'p1',
      mode: 'log',
      target: { kind: 'provider', injectorId: 'inj-r', token: 'TripStore', index: 2 },
    });
    expect(log.parentElement?.querySelector('[role="status"]')?.textContent).toBe(
      'Logged TripStore in the page console.',
    );
  });

  it('offers "Show in Components" only when the Components tab is on', async () => {
    const fixture = await render();
    const emitted: unknown[] = [];
    fixture.componentInstance.showComponent.subscribe((focus) => emitted.push(focus));
    fixture.componentInstance.select('inj-1');
    await settle(fixture);
    expect(host(fixture).querySelector('.show-component')).toBeNull();
    fixture.componentRef.setInput('canShowComponent', true);
    await settle(fixture);
    host(fixture).querySelector<HTMLButtonElement>('.show-component')!.click();
    expect(emitted).toEqual([{ id: 'c1', pageId: 'p1' }]);
  });
});
