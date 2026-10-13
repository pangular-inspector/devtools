// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callerStack,
  isAngularNotifyFrame,
  createCdDiagnosis,
  findCdScheduler,
  NOTIFY,
  templateOwner,
} from '../cd-diagnosis.ts';
import { PROFILER_EVENT as E } from '../cd-recorder.ts';
import type { RawSignalNode } from '../signal-history.ts';

class Shell {}
class Row {
  items: number[] = [];
}
(Shell as unknown as { ɵcmp: object }).ɵcmp = {};
(Row as unknown as { ɵcmp: object }).ɵcmp = {};

const APP_STACK = 'Error\n    at Cart.add (http://localhost:4200/src/app/cart.ts:12:5)';
const HTTP_STACK =
  'Error\n    at Users.load (http://localhost:4200/src/app/users.ts:8:3)\n    at _FetchBackend.doRequest (http://localhost:4200/@fs/node_modules/@angular/common/fesm2022/http.mjs:1:1)';

/** A fake app: an `ng` whose root injector holds a scheduler, and a root element. */
function fakePage(
  meta: Record<string, { inputs?: Record<string, string>; changeDetection?: number }> = {},
) {
  document.body.innerHTML = '<app-root ng-version="22.1.0"></app-root>';
  const notified: number[] = [];
  const scheduler = {
    appRef: {},
    runningTick: false,
    notify(source: number) {
      notified.push(source);
    },
  };
  const env = {
    records: new Map<unknown, { value: unknown }>([[class X {}, { value: scheduler }]]),
  };
  const ng = {
    getInjector: () => ({ node: true }),
    ɵgetInjectorResolutionPath: () => [{ node: true }, env],
    getDirectiveMetadata: (instance: object) => meta[instance.constructor.name] ?? null,
  };
  return { ng, scheduler, notified };
}

function setup(
  options: {
    meta?: Parameters<typeof fakePage>[0];
    global?: Record<string, unknown>;
    stack?: string;
    clock?: () => number;
  } = {},
) {
  const page = fakePage(options.meta);
  let onWrite: ((node: RawSignalNode) => void) | null = null;
  const removeHook = vi.fn();
  const diagnosis = createCdDiagnosis({
    getNg: () => page.ng,
    maxCycles: 5,
    // Spreading `globalThis` would lose its non-enumerable classes, such as MutationObserver.
    ...(options.global
      ? {
          global: () =>
            new Proxy(globalThis as unknown as Record<string, unknown>, {
              get: (target, key: string) =>
                key in options.global! ? options.global![key] : target[key],
            }),
        }
      : {}),
    stack: () => options.stack,
    ...(options.clock ? { now: options.clock } : {}),
    writeHook: async (fn) => {
      onWrite = fn;
      return removeHook;
    },
  });
  let id = 0;
  const cycle = (body: () => void = () => {}) => {
    diagnosis.onEvent(E.ChangeDetectionStart, undefined, undefined, ++id);
    diagnosis.onEvent(E.ChangeDetectionSyncStart, undefined, undefined, id);
    body();
    diagnosis.onEvent(E.ChangeDetectionSyncEnd, undefined, undefined, id);
    diagnosis.onEvent(E.ChangeDetectionEnd, undefined, undefined, null);
    return id;
  };
  /** A component check; `refresh` runs its template, `dom` changes the page while it runs. */
  const check = (instance: object, { refresh = true, dom = false, children = () => {} } = {}) => {
    diagnosis.onEvent(E.ComponentStart, undefined, undefined, id);
    if (refresh) diagnosis.onEvent(E.TemplateUpdateStart, instance, undefined, id);
    if (dom) document.body.append(document.createElement('span'));
    children();
    diagnosis.onEvent(E.ComponentEnd, instance, undefined, id);
  };
  return {
    ...page,
    diagnosis,
    cycle,
    check,
    removeHook,
    write: (debugName?: string) => onWrite?.({ debugName }),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('change detection diagnosis', () => {
  it('finds the scheduler among the values the root injector holds, and nothing on a bare page', () => {
    const { ng, scheduler } = fakePage();
    expect(findCdScheduler(ng, document.querySelectorAll('[ng-version]'))).toBe(scheduler);
    expect(findCdScheduler({}, document.querySelectorAll('[ng-version]'))).toBeNull();
    expect(findCdScheduler(null, [])).toBeNull();
  });

  it('wraps notify only while it records, and forwards every call', async () => {
    const t = setup();
    const original = t.scheduler.notify;
    t.diagnosis.start();
    expect(t.scheduler.notify).not.toBe(original);
    t.scheduler.notify(NOTIFY.MarkForCheck);
    expect(t.notified).toEqual([4]);
    await Promise.resolve();
    t.diagnosis.stop();
    expect(t.scheduler.notify).toBe(original);
    expect(t.removeHook).toHaveBeenCalled();
    t.scheduler.notify(NOTIFY.MarkForCheck);
    expect(t.notified).toEqual([4, 4]);
  });

  it('removes a write hook that finishes loading after the recording stopped', async () => {
    const t = setup();
    t.diagnosis.start();
    t.diagnosis.stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(t.removeHook).toHaveBeenCalledTimes(1);
  });

  it('credits a tick to the signal written and the app frame that wrote it', async () => {
    const t = setup({ stack: APP_STACK });
    t.diagnosis.start();
    await Promise.resolve();
    t.scheduler.notify(NOTIFY.MarkAncestorsForTraversal);
    t.write('count');
    t.scheduler.notify(NOTIFY.RootEffect);
    const id = t.cycle();
    expect(t.diagnosis.cycle(id).cause).toEqual({
      kind: 'signal',
      component: 'Cart',
      signal: 'count',
      stack: ['Cart.add (src/app/cart.ts:12:5)'],
      more: 1,
    });
  });

  it('names the component, not the @for context, for a listener inside a block', () => {
    const t = setup();
    t.diagnosis.start();
    class RepeaterContext {}
    const listener = function HttpExample_For_3_Template_button_click_0_listener() {};
    t.scheduler.notify(NOTIFY.Listener);
    t.diagnosis.onEvent(E.OutputStart, new RepeaterContext(), listener, null);
    const id = t.cycle();
    expect(t.diagnosis.cycle(id).cause).toMatchObject({
      component: 'HttpExample',
      listener: 'HttpExample_For_3_Template_button_click_0_listener',
    });

    // Without a compiled listener name the context gives no owner at all.
    t.scheduler.notify(NOTIFY.Listener);
    t.diagnosis.onEvent(E.OutputStart, new RepeaterContext(), () => {}, null);
    const next = t.cycle();
    expect(t.diagnosis.cycle(next).cause?.component).toBeUndefined();
  });

  it('reads the component from compiled template function names', () => {
    expect(templateOwner('App_Template')).toBe('App');
    expect(templateOwner('App_Template_button_click_0_listener')).toBe('App');
    expect(templateOwner('App_Conditional_2_Template_a_click_1_listener')).toBe('App');
    expect(templateOwner('My_Card_ForEmpty_5_Template')).toBe('My_Card');
    expect(templateOwner('List_ng_template_2_Template_li_click_0_listener')).toBe('List');
    expect(templateOwner('_App_Template')).toBe('App');
    expect(templateOwner('onClick')).toBeUndefined();
  });

  it('says whether the page loads zone.js', async () => {
    const zoneless = setup({ global: { Zone: undefined } });
    zoneless.diagnosis.start();
    expect(zoneless.diagnosis.snapshot()?.zoneJs).toBe(false);
    zoneless.diagnosis.stop();
    const zoned = setup({ global: { Zone: { current: { get: () => false } } } });
    zoned.diagnosis.start();
    expect(zoned.diagnosis.snapshot()?.zoneJs).toBe(true);
    zoned.diagnosis.stop();
  });

  it('names a template listener by its DOM event, target and owner', () => {
    const t = setup();
    t.diagnosis.start();
    const button = document.createElement('button');
    document.body.append(button);
    const listener = function Cart_Template_button_click_0_listener() {};
    let id = 0;
    button.addEventListener('click', () => {
      t.scheduler.notify(NOTIFY.Listener);
      t.diagnosis.onEvent(E.OutputStart, new Row(), listener, null);
      t.diagnosis.onEvent(E.OutputEnd, new Row(), listener, null);
    });
    button.click();
    id = t.cycle();
    expect(t.diagnosis.cycle(id).cause).toEqual({
      kind: 'event',
      event: 'click',
      target: 'button',
      component: 'Row',
      listener: 'Cart_Template_button_click_0_listener',
    });
  });

  it('calls code on an HTTP response http, from the XHR load event or the fetch backend frames', () => {
    const t = setup({ stack: HTTP_STACK });
    t.diagnosis.start();
    t.scheduler.notify(NOTIFY.MarkForCheck);
    const id = t.cycle();
    expect(t.diagnosis.cycle(id).cause).toMatchObject({
      kind: 'http',
      via: 'markForCheck',
      component: 'Users',
    });

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => t.scheduler.notify(NOTIFY.MarkAncestorsForTraversal));
    xhr.dispatchEvent(new Event('load'));
    const next = t.cycle();
    expect(t.diagnosis.cycle(next).cause).toMatchObject({ kind: 'http', via: 'signal' });
    expect(t.diagnosis.cycle(next).cause?.event).toBeUndefined();
  });

  it('reads zone.js tasks: a timer, a zone-only tick and the components that changed in it', () => {
    const zone = {
      current: { get: (key: string) => key === 'isAngularZone' },
      currentTask: { type: 'macroTask', source: 'setTimeout' } as {
        type: string;
        source: string;
      } | null,
    };
    const t = setup({ global: { Zone: zone }, meta: { Row: { changeDetection: 1 } } });
    t.diagnosis.start();
    t.scheduler.notify(NOTIFY.MarkForCheck);
    const timer = t.cycle();
    expect(t.diagnosis.cycle(timer).cause).toMatchObject({
      kind: 'timer',
      via: 'markForCheck',
      task: 'setTimeout',
      zone: true,
    });

    const row = new Row();
    const zoneOnly = t.cycle(() => t.check(row, { dom: true }));
    expect(t.diagnosis.cycle(zoneOnly).cause).toEqual({
      kind: 'zone',
      zone: true,
      task: 'setTimeout',
    });
    zone.currentTask = { type: 'macroTask', source: 'XMLHttpRequest.send' };
    t.cycle(() => t.check(row, { dom: true }));
    expect(t.diagnosis.snapshot()?.zone).toEqual([
      { name: 'Row', ticks: 2, tasks: ['setTimeout', 'XMLHttpRequest.send'] },
    ]);
    expect(t.diagnosis.snapshot()?.causes).toEqual({ timer: 1, zone: 2 });
  });

  it('marks a tick the scheduler ran without a seen notification unknown, and one app code ran tick', () => {
    const t = setup({ stack: APP_STACK });
    t.diagnosis.start();
    t.scheduler.runningTick = true;
    const scheduled = t.cycle();
    expect(t.diagnosis.cycle(scheduled).cause).toEqual({ kind: 'unknown' });
    t.scheduler.runningTick = false;
    const manual = t.cycle();
    expect(t.diagnosis.cycle(manual).cause).toEqual({
      kind: 'tick',
      component: 'Cart',
      stack: ['Cart.add (src/app/cart.ts:12:5)'],
    });
  });

  it('lets a refreshing notification replace one that only runs afterRender, and drops a stale one', () => {
    let now = 0;
    const t = setup({ clock: () => now });
    t.diagnosis.start();
    t.scheduler.notify(NOTIFY.PendingTaskRemoved);
    t.scheduler.notify(NOTIFY.MarkForCheck);
    expect(t.diagnosis.cycle(t.cycle()).cause).toEqual({ kind: 'markForCheck', more: 1 });

    t.scheduler.notify(NOTIFY.PendingTaskRemoved);
    now = 500;
    t.scheduler.runningTick = true;
    expect(t.diagnosis.cycle(t.cycle()).cause).toMatchObject({ kind: 'unknown' });
  });

  it('ignores notifications Angular sends while a tick runs', () => {
    const t = setup();
    t.diagnosis.start();
    t.scheduler.notify(NOTIFY.SetInput);
    const id = t.cycle(() => t.scheduler.notify(NOTIFY.MarkForCheck));
    expect(t.diagnosis.cycle(id).cause).toEqual({ kind: 'input' });
    t.scheduler.runningTick = true;
    expect(t.diagnosis.cycle(t.cycle()).cause).toEqual({ kind: 'unknown' });
  });

  it('counts refreshed checks without DOM updates, and leaves out traversals and the checkNoChanges pass', () => {
    const t = setup({ meta: { Shell: { changeDetection: 0 }, Row: { changeDetection: 1 } } });
    t.diagnosis.start();
    const shell = new Shell();
    const row = new Row();
    const id = t.cycle(() => {
      t.check(shell, { dom: false, children: () => t.check(row, { dom: true }) });
      // Visited without running its template: not a refresh.
      t.check(new Shell(), { refresh: false });
    });
    // The development checkNoChanges pass runs after the last sync pass.
    t.diagnosis.onEvent(E.ChangeDetectionStart, undefined, undefined, 99);
    t.check(row);
    t.diagnosis.onEvent(E.ChangeDetectionEnd, undefined, undefined, null);

    expect(t.diagnosis.cycle(id)).toMatchObject({ refreshed: 2, unchanged: 1 });
    const snap = t.diagnosis.snapshot(22)!;
    expect(snap.components).toEqual([
      { name: 'Shell', refreshed: 1, unchanged: 1, strategy: 'OnPush' },
      { name: 'Row', refreshed: 1, unchanged: 0, strategy: 'Eager' },
    ]);
    expect(snap.major).toBe(22);
    expect(snap.waste).toBe(true);
    expect(snap.triggers).toBe(true);
  });

  it('finds inputs mutated in place and new references with equal contents, crediting the parent', () => {
    const t = setup({ meta: { Row: { inputs: { items: 'items' } } } });
    t.diagnosis.start();
    const shell = new Shell();
    const row = new Row();
    const pass = () => t.cycle(() => t.check(shell, { children: () => t.check(row) }));
    row.items = [1];
    pass();
    row.items.push(2);
    pass();
    row.items = [...row.items];
    const renewed = pass();
    expect(t.diagnosis.snapshot()?.inputs).toEqual([
      { name: 'Row', input: 'items', parent: 'Shell', inPlace: 1, sameContents: 1 },
    ]);
    // The new reference counts as a change of the parent's check.
    expect(t.diagnosis.cycle(renewed)).toMatchObject({ refreshed: 2, unchanged: 1 });
  });

  it("reads a signal input's stored value without calling it", () => {
    const t = setup({ meta: { Row: { inputs: { items: 'items' } } } });
    t.diagnosis.start();
    const node = { value: [1] as number[] };
    const read = vi.fn(() => node.value);
    const SIGNAL = Symbol('SIGNAL');
    const items = Object.assign(read, { [SIGNAL]: node });
    const row = Object.assign(new Row(), { items }) as unknown as Row;
    t.cycle(() => t.check(row));
    node.value.push(2);
    t.cycle(() => t.check(row));
    expect(read).not.toHaveBeenCalled();
    expect(t.diagnosis.snapshot()?.inputs?.[0]).toMatchObject({ input: 'items', inPlace: 1 });
  });

  it('cuts the overlay and Angular frames a bundled build shares chunk files with', () => {
    const bundled = [
      'Error',
      '    at captureStack (chunk-IPR3QYBB.js:12111:12)',
      '    at onNotify (chunk-IPR3QYBB.js:15893:55)',
      '    at ChangeDetectionSchedulerImpl.wrapper [as notify] (chunk-IPR3QYBB.js:16105:9)',
      '    at markViewDirty (chunk-IPR3QYBB.js:900:3)',
      '    at _ViewRef.markForCheck (chunk-IPR3QYBB.js:950:5)',
      '    at _EagerClock.tick (chunk-APP.js:20:7)',
    ].join('\n');
    const t = setup({ stack: bundled });
    t.diagnosis.start();
    t.scheduler.notify(NOTIFY.MarkForCheck);
    expect(t.diagnosis.cycle(t.cycle()).cause).toEqual({
      kind: 'markForCheck',
      component: 'EagerClock',
      stack: ['EagerClock.tick (chunk-APP.js:20:7)'],
    });
    const firefox = 'wrapper@chunk.js:1:1\nmarkViewDirty@chunk.js:2:2\nPoller.poll@app.js:3:3';
    expect(
      callerStack(firefox, (line) => line.startsWith('wrapper@'), { skip: /^markViewDirty$/ }),
    ).toBe('Error\nPoller.poll@app.js:3:3');
    expect(callerStack('no marker here', () => false)).toBe('no marker here');
  });

  it("keeps an app method named like a step of Angular's notify path", () => {
    const raw = [
      'Error',
      '    at wrapper [as notify] (chunk.js:1:1)',
      '    at markViewDirty (chunk.js:2:2)',
      '    at signalFn.set (chunk.js:3:3)',
      '    at CartStore.update (src/app/cart.store.ts:12:5)',
      '    at Cart.add (src/app/cart.ts:4:4)',
    ].join('\n');
    expect(
      callerStack(raw, (line) => /\[as notify\]/.test(line), { skip: isAngularNotifyFrame }),
    ).toBe(
      'Error\n    at CartStore.update (src/app/cart.store.ts:12:5)\n    at Cart.add (src/app/cart.ts:4:4)',
    );
  });

  it('credits ApplicationRef.tick to the app frame below it', () => {
    const t = setup({
      stack: [
        'Error',
        '    at captureStack (chunk.js:1:1)',
        '    at dispatch (chunk.js:2:2)',
        '    at _ApplicationRef._tick (chunk.js:3:3)',
        '    at _ApplicationRef.tick (chunk.js:4:4)',
        '    at _Poller.refresh (chunk-APP.js:5:5)',
      ].join('\n'),
    });
    t.diagnosis.start();
    expect(t.diagnosis.cycle(t.cycle()).cause).toEqual({
      kind: 'tick',
      component: 'Poller',
      stack: ['Poller.refresh (chunk-APP.js:5:5)'],
    });
  });

  it('marks every tick unknown when the page has no scheduler, never zone.js only', () => {
    const zone = {
      current: { get: (key: string) => key === 'isAngularZone' },
      currentTask: { type: 'macroTask', source: 'setTimeout' },
    };
    const t = setup({ global: { Zone: zone } });
    t.ng.ɵgetInjectorResolutionPath = () => [];
    t.diagnosis.start();
    const id = t.cycle(() => t.check(new Row(), { dom: true }));
    expect(t.diagnosis.cycle(id).cause).toEqual({
      kind: 'unknown',
      zone: true,
      task: 'setTimeout',
    });
    expect(t.diagnosis.snapshot()).toMatchObject({ triggers: false, waste: true });
    expect(t.diagnosis.snapshot()?.zone).toBeUndefined();
  });

  it('keeps per-cycle data for the ids the recorder still holds, and empties on clear', () => {
    const t = setup();
    t.diagnosis.start();
    for (let i = 0; i < 8; i++) t.cycle();
    expect(t.diagnosis.cycle(1)).toEqual({});
    expect(t.diagnosis.cycle(8).cause).toEqual({ kind: 'tick' });
    t.diagnosis.clear();
    expect(t.diagnosis.cycle(8)).toEqual({});
    expect(t.diagnosis.snapshot()?.causes).toEqual({});
  });

  it('reports nothing before the first start, and what it could hook after a stop', () => {
    const t = setup();
    expect(t.diagnosis.snapshot()).toBeUndefined();
    t.diagnosis.onEvent(E.ChangeDetectionStart, undefined, undefined, 1);
    t.diagnosis.onEvent(E.ChangeDetectionEnd, undefined, undefined, null);
    expect(t.diagnosis.cycle(1)).toEqual({});
    t.diagnosis.start();
    t.diagnosis.stop();
    expect(t.diagnosis.snapshot()).toMatchObject({ triggers: true, waste: true });
  });
});
