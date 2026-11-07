// @vitest-environment jsdom
import { createHostContext } from 'devframe/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RPC_INSPECTOR, SHARED_STATE_INSPECTOR } from '../config.ts';
import { createPangular } from '../devframe.ts';
import { elementById } from '../element-id.ts';
import { IonicStacks, attachIonic, type IonicReport } from '../ionic-collector.ts';
import { toIonicPage, type IonicState } from '../rpc/ionic-register.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

class HomePage {}
class DetailPage {}
class SettingsPage {}

type Listener = (event: Record<string, unknown>) => void;

/** An `EventEmitter` as far as the collector reads it. */
function emitter() {
  const listeners = new Set<Listener>();
  return {
    listeners,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return { unsubscribe: () => listeners.delete(listener) };
    },
    emit(event: Record<string, unknown>) {
      for (const listener of listeners) listener(event);
    },
  };
}

/**
 * A fake `IonRouterOutlet` directive with the fields of @ionic/angular's
 * `common/directives/navigation/router-outlet.js` and `stack-controller.js`:
 * `name`, `tabsPrefix`, `stackDidChange`, and `stackCtrl.views` and
 * `stackCtrl.activeView`, whose views hold `id`, `url`, `stackId`, `element`
 * and `ref`.
 */
function fakeOutlet(outletEl: Element) {
  let nextId = 0;
  const views: Record<string, unknown>[] = [];
  const outlet = {
    name: 'primary',
    tabsPrefix: undefined as string | undefined,
    stackDidChange: emitter(),
    stackCtrl: { views, activeView: undefined as Record<string, unknown> | undefined },
  };
  const view = (tag: string, type: unknown, url: string) => {
    const element = document.createElement(tag);
    element.classList.add('ion-page');
    outletEl.append(element);
    return {
      id: nextId++,
      url,
      stackId: undefined,
      element,
      ref: { componentType: type, instance: {} },
    };
  };
  return { outlet, view };
}

function fakeNg(directives: Map<Element, unknown[]>) {
  return { getDirectives: (el: Element) => directives.get(el) ?? [] };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('mode');
});

describe('Ionic page stacks', () => {
  it('reads each page of an ion-router-outlet stack with the active one and stable ids', () => {
    document.documentElement.setAttribute('mode', 'ios');
    document.body.innerHTML = '<ion-app><ion-router-outlet></ion-router-outlet></ion-app>';
    const outletEl = document.querySelector('ion-router-outlet')!;
    const { outlet, view } = fakeOutlet(outletEl);
    const home = view('app-home', HomePage, '/home');
    const detail = view('app-detail', DetailPage, `/detail/7?token=${JWT}`);
    outlet.stackCtrl.views.push(home, detail);
    outlet.stackCtrl.activeView = detail;
    const stacks = new IonicStacks(() => {});
    const ng = fakeNg(new Map([[outletEl, [{ other: true }, outlet]]]));

    const report = stacks.read(ng, document)!;
    expect(report.framework).toBe('@ionic/angular');
    expect(report.mode).toBe('ios');
    expect(report.outlets).toHaveLength(1);
    const [first] = report.outlets;
    expect(first.source).toBe('angular');
    expect(first.name).toBe('primary');
    expect(first.canGoBack).toBe(true);
    expect(first.pages.map(({ component, tag, active }) => ({ component, tag, active }))).toEqual([
      { component: 'HomePage', tag: 'app-home', active: false },
      { component: 'DetailPage', tag: 'app-detail', active: true },
    ]);
    expect(first.pages[0].url).toBe('/home');
    expect(JSON.stringify(report)).not.toContain(JWT);
    expect(elementById(first.pages[1].elementId)).toBe(detail.element);
    expect(elementById(first.id)).toBe(outletEl);
    // Never writes to the app's DOM.
    expect(outletEl.outerHTML).not.toMatch(/data-|pangular/);

    const again = stacks.read(ng, document)!;
    expect(again.outlets[0].id).toBe(first.id);
    expect(again.outlets[0].pages.map((page) => page.elementId)).toEqual(
      first.pages.map((page) => page.elementId),
    );
  });

  it('infers forward, back and root from how the stack changed', () => {
    document.body.innerHTML = '<ion-router-outlet></ion-router-outlet>';
    const outletEl = document.querySelector('ion-router-outlet')!;
    const { outlet, view } = fakeOutlet(outletEl);
    delete (outlet as Partial<typeof outlet>).stackDidChange;
    const ng = fakeNg(new Map([[outletEl, [outlet]]]));
    const stacks = new IonicStacks(() => {});
    const home = view('app-home', HomePage, '/home');
    outlet.stackCtrl.views.push(home);
    outlet.stackCtrl.activeView = home;
    expect(stacks.read(ng, document)!.outlets[0].direction).toBeUndefined();

    const detail = view('app-detail', DetailPage, '/detail');
    outlet.stackCtrl.views.push(detail);
    outlet.stackCtrl.activeView = detail;
    const forward = stacks.read(ng, document)!.outlets[0];
    expect([forward.direction, forward.directionSource]).toEqual(['forward', 'inferred']);

    outlet.stackCtrl.views.pop();
    outlet.stackCtrl.activeView = home;
    expect(stacks.read(ng, document)!.outlets[0].direction).toBe('back');

    const settings = view('app-settings', SettingsPage, '/settings');
    outlet.stackCtrl.views.splice(0, outlet.stackCtrl.views.length, settings);
    outlet.stackCtrl.activeView = settings;
    expect(stacks.read(ng, document)!.outlets[0].direction).toBe('root');
  });

  it('takes the direction from stackDidChange and stops listening on stop', () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<ion-router-outlet></ion-router-outlet>';
      const outletEl = document.querySelector('ion-router-outlet')!;
      const { outlet, view } = fakeOutlet(outletEl);
      outlet.tabsPrefix = '/tabs/tab1';
      const ng = fakeNg(new Map([[outletEl, [outlet]]]));
      const changed = vi.fn();
      const stacks = new IonicStacks(changed);
      const home = view('app-home', HomePage, '/tabs/tab1');
      const detail = view('app-detail', DetailPage, '/tabs/tab1/detail');
      outlet.stackCtrl.views.push(home, detail);
      outlet.stackCtrl.activeView = detail;
      expect(stacks.read(ng, document)!.outlets[0].tabs).toBe('/tabs/tab1');
      expect(outlet.stackDidChange.listeners.size).toBe(1);

      // Ionic emits after the transition: the stack already changed when it comes.
      outlet.stackCtrl.views.pop();
      outlet.stackCtrl.activeView = home;
      expect(stacks.read(ng, document)!.outlets[0].directionSource).toBe('inferred');
      outlet.stackDidChange.emit({
        enteringView: home,
        direction: 'root',
        animation: undefined,
        tabSwitch: true,
      });
      vi.runAllTimers();
      expect(changed).toHaveBeenCalled();
      const after = stacks.read(ng, document)!.outlets[0];
      expect(after).toMatchObject({
        direction: 'root',
        directionSource: 'event',
        animated: false,
        tabSwitch: true,
      });

      stacks.stop();
      expect(outlet.stackDidChange.listeners.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to the outlet pages in the DOM without the Angular directive', () => {
    document.body.innerHTML = `
      <ion-router-outlet name="menu">
        <app-home class="ion-page ion-page-hidden"></app-home>
        <app-detail class="ion-page"></app-detail>
        <div class="not-a-page"></div>
      </ion-router-outlet>`;
    const report = new IonicStacks(() => {}).read({}, document)!;
    expect(report.framework).toBe('@ionic/core');
    const [outlet] = report.outlets;
    expect(outlet).toMatchObject({ name: 'menu', source: 'dom', canGoBack: true });
    expect(outlet.pages.map(({ tag, active, url }) => ({ tag, active, url }))).toEqual([
      { tag: 'app-home', active: false, url: undefined },
      { tag: 'app-detail', active: true, url: undefined },
    ]);
  });

  it('reports nothing on a page without Ionic', () => {
    document.body.innerHTML = '<app-root></app-root>';
    expect(new IonicStacks(() => {}).read({}, document)).toBeNull();
  });
});

describe('attachIonic', () => {
  beforeEach(() => {
    document.body.innerHTML = '<ion-app><ion-router-outlet></ion-router-outlet></ion-app>';
  });

  it('pushes with the pageId, skips an unchanged report and forgets the page on leave', async () => {
    const calls: [string, unknown][] = [];
    const my = {
      rpc: {
        call: async (name: string, arg: unknown) => {
          calls.push([name, arg]);
          return undefined;
        },
      },
    };
    const ionic = attachIonic(my, 'tab1', () => ({}), { tickMs: () => 500 });
    await ionic.push();
    await ionic.push();
    expect(calls.map(([name]) => name)).toEqual(['push-ionic']);
    const report = calls[0][1] as IonicReport;
    expect(report.pageId).toBe('tab1');
    expect(report.outlets[0].source).toBe('dom');

    document
      .querySelector('ion-router-outlet')!
      .append(Object.assign(document.createElement('app-home'), { className: 'ion-page' }));
    await ionic.push();
    expect(calls.filter(([name]) => name === 'push-ionic')).toHaveLength(2);

    ionic.leave();
    expect(calls.at(-1)).toEqual(['forget-ionic-page', 'tab1']);
    await ionic.push();
    expect(calls.at(-1)?.[0]).toBe('forget-ionic-page');
    ionic.stop();
  });

  it('sends nothing on a page without Ionic', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    const call = vi.fn(async () => undefined);
    const ionic = attachIonic({ rpc: { call } }, 'tab1', () => ({}));
    await ionic.push();
    ionic.leave();
    expect(call).not.toHaveBeenCalled();
  });
});

describe('Ionic on the server', () => {
  async function boot() {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await createPangular({}).setup(ctx as never);
    const call = (name: string, payload: unknown) =>
      ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
    const state = async () =>
      (
        await (
          ctx.rpc as unknown as {
            sharedState: { get: (key: string) => Promise<{ value: () => IonicState }> };
          }
        ).sharedState.get('pangular:ionic')
      ).value();
    return { call, state };
  }

  const report = (pageId = 'tab1') => ({
    pageId,
    url: `/home?token=${JWT}`,
    title: 'Ionic app',
    framework: '@ionic/angular',
    mode: 'md',
    outlets: [
      {
        id: 'c1-1',
        name: 'primary',
        source: 'angular',
        canGoBack: false,
        direction: 'forward',
        directionSource: 'event',
        animated: true,
        pages: [
          { component: 'HomePage', tag: 'app-home', url: '/home', active: true, elementId: 'c1-2' },
          { component: 'Bad', tag: 'x', active: false, elementId: 'not valid!' },
        ],
      },
    ],
  });

  it('keeps the known fields, masks the URL and drops malformed pages', () => {
    const page = toIonicPage({ ...report(), outlets: [...report().outlets, { id: 3 }] }, 5)!;
    expect(page.reportedAt).toBe(5);
    expect(page.outlets).toHaveLength(1);
    expect(page.outlets[0].pages.map((p) => p.component)).toEqual(['HomePage']);
    expect(JSON.stringify(page)).not.toContain(JWT);
    expect(toIonicPage({ pageId: 'tab1' })).toBeNull();
    expect(toIonicPage({ ...report(), framework: 'other' })?.framework).toBe('@ionic/core');
  });

  it('stores one entry per page and forgets it', async () => {
    const { call, state } = await boot();
    await call('push-ionic', report('tab1'));
    await call('push-ionic', report('tab2'));
    expect(Object.keys((await state()).pages).sort()).toEqual(['tab1', 'tab2']);
    await call('forget-ionic-page', 'tab1');
    expect(Object.keys((await state()).pages)).toEqual(['tab2']);
  });

  it('belongs to the Capacitor inspector', () => {
    expect(RPC_INSPECTOR['push-ionic']).toBe('capacitor');
    expect(RPC_INSPECTOR['forget-ionic-page']).toBe('capacitor');
    expect(SHARED_STATE_INSPECTOR['ionic']).toBe('capacitor');
  });
});
