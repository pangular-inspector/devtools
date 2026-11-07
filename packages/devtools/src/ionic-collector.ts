import { keepaliveDue } from './change-detection.ts';
import { elementId } from './element-id.ts';
import { setTimeoutOutside } from './outside-angular.ts';
import { componentName, read, redactMessage, redactUrl, type AnyRecord } from './router.ts';

/** One page in an `ion-router-outlet` stack. */
export interface IonicStackPage {
  /** The page's root component class, else its tag. */
  component: string;
  /** The page element's tag, such as `app-home`. */
  tag: string;
  /** The URL Ionic stored for the page, redacted. Missing when read from the DOM. */
  url?: string;
  /** The page shown now. */
  active: boolean;
  /** Stable id of the page element, for the panel's highlight (`element-id.ts`). */
  elementId: string;
}

export type IonicDirection = 'forward' | 'back' | 'root';

/** One `ion-router-outlet` and its page stack, oldest page first. */
export interface IonicOutlet {
  /** Stable id of the outlet element (`element-id.ts`). */
  id: string;
  /** The outlet's `name` (`primary` by default). */
  name: string;
  /** The tab URL prefix of an outlet inside `ion-tabs`. */
  tabs?: string;
  /**
   * `angular`: read from the `IonRouterOutlet` directive's stack controller.
   * `dom`: read from the outlet's `.ion-page` children, without URLs.
   */
  source: 'angular' | 'dom';
  pages: IonicStackPage[];
  /** Pages past the first `MAX_PAGES` that were left out. */
  truncated?: number;
  /** True when a back navigation is possible within the active page's stack. */
  canGoBack?: boolean;
  /** The direction of the last navigation in this outlet, when it is known. */
  direction?: IonicDirection;
  /**
   * `event`: from the outlet's `stackDidChange` output. `inferred`: from how
   * the stack changed between two reads.
   */
  directionSource?: 'event' | 'inferred';
  /** The last navigation animated. Only with `directionSource: 'event'`. */
  animated?: boolean;
  /** The last navigation switched tabs. Only with `directionSource: 'event'`. */
  tabSwitch?: boolean;
}

/** What the page reports about Ionic, as `push-ionic`. */
export interface IonicReport {
  pageId: string;
  url: string;
  title: string;
  /** `@ionic/angular` when an outlet has the Angular directive, else `@ionic/core`. */
  framework: '@ionic/angular' | '@ionic/core';
  /** Ionic's mode, from the `mode` attribute it sets on `<html>`. */
  mode?: string;
  outlets: IonicOutlet[];
  /** Outlets past the first `MAX_OUTLETS` that were left out. */
  truncatedOutlets?: number;
}

export const MAX_OUTLETS = 20;
export const MAX_PAGES = 50;

interface IonicDebugApi {
  getDirectives?(el: Element): unknown[];
}

interface Remembered {
  views: unknown[];
  active: unknown;
  direction?: IonicDirection;
  directionSource?: 'event' | 'inferred';
  animated?: boolean;
  tabSwitch?: boolean;
  /** The view the last `stackDidChange` event entered. */
  eventView?: unknown;
  unsubscribe?: () => void;
}

const DIRECTIONS: readonly string[] = ['forward', 'back', 'root'];

/** The `IonRouterOutlet` directive on an outlet element: the one with a stack controller. */
function outletDirective(ng: IonicDebugApi | undefined, el: Element): AnyRecord | null {
  const directives = read(() => ng?.getDirectives?.(el) ?? [], [] as unknown[]);
  for (const directive of directives) {
    const views = read(() => (directive as AnyRecord)['stackCtrl']?.['views'], undefined);
    if (Array.isArray(views)) return directive as AnyRecord;
  }
  return null;
}

function tagOf(el: unknown): string {
  return read(() => String((el as Element).localName ?? ''), '') || 'unknown';
}

/**
 * Reads the page stack of every `ion-router-outlet` on the page. Remembers
 * each outlet's last stack in a `WeakMap`, so the direction of the last
 * navigation can be inferred when no `stackDidChange` event was seen, and
 * never writes to the page's DOM.
 */
export class IonicStacks {
  private readonly remembered = new WeakMap<object, Remembered>();
  private readonly subscribed = new Set<Remembered>();
  private readonly onChange: () => void;

  constructor(onChange: () => void) {
    this.onChange = onChange;
  }

  /** The report body for this page, or null when the page has no Ionic. */
  read(
    ng: IonicDebugApi | undefined,
    doc: Document,
  ): Omit<IonicReport, 'pageId' | 'url' | 'title'> | null {
    const elements = read(() => Array.from(doc.querySelectorAll('ion-router-outlet')), []);
    if (!elements.length && !read(() => !!doc.querySelector('ion-app'), false)) return null;
    let angular = false;
    const outlets: IonicOutlet[] = [];
    for (const el of elements.slice(0, MAX_OUTLETS)) {
      const directive = outletDirective(ng, el);
      if (directive) angular = true;
      outlets.push(directive ? this.fromDirective(el, directive) : this.fromDom(el));
    }
    const report: Omit<IonicReport, 'pageId' | 'url' | 'title'> = {
      framework: angular ? '@ionic/angular' : '@ionic/core',
      outlets,
    };
    const mode = read(() => doc.documentElement.getAttribute('mode'), null);
    if (mode) report.mode = redactMessage(mode).slice(0, 20);
    if (elements.length > MAX_OUTLETS) report.truncatedOutlets = elements.length - MAX_OUTLETS;
    return report;
  }

  /** Stops listening to every outlet's `stackDidChange`. */
  stop(): void {
    for (const memory of this.subscribed) memory.unsubscribe?.();
    this.subscribed.clear();
  }

  private memoryOf(key: object): Remembered {
    let memory = this.remembered.get(key);
    if (!memory) {
      memory = { views: [], active: null };
      this.remembered.set(key, memory);
    }
    return memory;
  }

  private fromDirective(el: Element, directive: AnyRecord): IonicOutlet {
    const stack = directive['stackCtrl'] as AnyRecord;
    const views = read(() => [...(stack['views'] as AnyRecord[])], [] as AnyRecord[]);
    const active = read(() => stack['activeView'] as AnyRecord | undefined, undefined) ?? null;
    const memory = this.memoryOf(directive);
    this.listen(directive, memory);
    this.infer(memory, views, active);
    const shown = views.slice(0, MAX_PAGES);
    const outlet: IonicOutlet = {
      id: elementId(el),
      name: redactMessage(read(() => String(directive['name'] ?? 'primary'), 'primary')).slice(
        0,
        100,
      ),
      source: 'angular',
      pages: shown.map((view) => {
        const element = read(() => view['element'] as Element | undefined, undefined);
        const ref = read(() => view['ref'] as AnyRecord | undefined, undefined);
        const type = read(
          () => ref?.['componentType'] ?? ref?.['instance']?.['constructor'],
          undefined,
        );
        const tag = tagOf(element);
        const name = type ? read(() => componentName(type), '') : '';
        const page: IonicStackPage = {
          component: (name && name !== 'Object' ? name : tag).slice(0, 200),
          tag,
          active: view === active,
          elementId: element ? elementId(element) : elementId(view),
        };
        const url = read(() => view['url'] as unknown, undefined);
        if (typeof url === 'string') page.url = redactUrl(url);
        return page;
      }),
    };
    const tabs = read(() => directive['tabsPrefix'] as unknown, undefined);
    if (typeof tabs === 'string' && tabs) outlet.tabs = redactUrl(tabs);
    if (views.length > MAX_PAGES) outlet.truncated = views.length - MAX_PAGES;
    if (active) {
      const stackId = read(() => active['stackId'] as unknown, undefined);
      outlet.canGoBack = views.filter((view) => view['stackId'] === stackId).length > 1;
    }
    this.describeDirection(outlet, memory);
    return outlet;
  }

  private fromDom(el: Element): IonicOutlet {
    const children = read(
      () => Array.from(el.children).filter((child) => child.classList.contains('ion-page')),
      [] as Element[],
    );
    const visible = children.filter((child) => !child.classList.contains('ion-page-hidden'));
    const active = visible[visible.length - 1] ?? null;
    const memory = this.memoryOf(el);
    this.infer(memory, children, active);
    const outlet: IonicOutlet = {
      id: elementId(el),
      name: redactMessage(read(() => el.getAttribute('name') ?? 'primary', 'primary')).slice(
        0,
        100,
      ),
      source: 'dom',
      pages: children.slice(0, MAX_PAGES).map((child) => ({
        component: tagOf(child),
        tag: tagOf(child),
        active: child === active,
        elementId: elementId(child),
      })),
    };
    if (children.length > MAX_PAGES) outlet.truncated = children.length - MAX_PAGES;
    outlet.canGoBack = children.length > 1;
    this.describeDirection(outlet, memory);
    return outlet;
  }

  /**
   * Listens to the outlet's `stackDidChange` output, which carries the
   * direction Ionic used. It only reads the event; the callback runs in the
   * app's zone, so the push it asks for is scheduled outside it.
   */
  private listen(directive: AnyRecord, memory: Remembered): void {
    if (memory.unsubscribe) return;
    const output = read(() => directive['stackDidChange'] as AnyRecord | undefined, undefined);
    if (!output || typeof output['subscribe'] !== 'function') return;
    const subscription = read(
      () =>
        output['subscribe']((event: AnyRecord) => {
          const direction = read(() => event?.['direction'] as unknown, undefined);
          if (typeof direction !== 'string' || !DIRECTIONS.includes(direction)) return;
          memory.direction = direction as IonicDirection;
          memory.directionSource = 'event';
          memory.eventView = read(() => event['enteringView'] as unknown, undefined);
          memory.animated = read(() => !!event['animation'], false);
          memory.tabSwitch = read(() => event['tabSwitch'] === true, false);
          setTimeoutOutside(this.onChange, 0);
        }) as { unsubscribe(): void },
      null,
    );
    if (!subscription) return;
    memory.unsubscribe = () => read(() => subscription.unsubscribe(), undefined);
    this.subscribed.add(memory);
  }

  /** Infers the direction of a navigation from how the stack changed since the last read. */
  private infer(memory: Remembered, views: unknown[], active: unknown): void {
    const previous = memory.views;
    const before = memory.active;
    memory.views = views;
    memory.active = active;
    if (!previous.length || !active || active === before) return;
    // The event for this navigation already said which way it went.
    if (memory.directionSource === 'event' && memory.eventView === active) return;
    const was = previous.indexOf(before);
    const now = views.indexOf(active);
    let direction: IonicDirection;
    if (!previous.includes(active)) direction = views.length === 1 ? 'root' : 'forward';
    else direction = now < was ? 'back' : 'forward';
    memory.direction = direction;
    memory.directionSource = 'inferred';
    memory.animated = undefined;
    memory.tabSwitch = undefined;
  }

  private describeDirection(outlet: IonicOutlet, memory: Remembered): void {
    if (!memory.direction) return;
    outlet.direction = memory.direction;
    if (memory.directionSource) outlet.directionSource = memory.directionSource;
    if (memory.directionSource === 'event') {
      if (memory.animated !== undefined) outlet.animated = memory.animated;
      if (memory.tabSwitch) outlet.tabSwitch = true;
    }
  }
}

interface Rpc {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

export interface IonicOptions {
  /** How often the overlay refreshes (`limits.refreshMs`), for the keepalive. */
  tickMs?: () => number;
  doc?: Document;
}

/**
 * Reports the `ion-router-outlet` stacks of an Ionic page as `push-ionic`,
 * part of the Capacitor inspector. A page without Ionic sends nothing. An
 * unchanged report goes again only when the keepalive is due.
 */
export function attachIonic(
  my: Rpc,
  pageId: string,
  getNg: () => unknown,
  options: IonicOptions = {},
) {
  const tickMs = options.tickMs ?? (() => 0);
  let lastJson = '';
  let sentAt = 0;
  let sent = false;
  let left = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const push = async (force = false): Promise<void> => {
    if (left || stopped) return;
    const doc = options.doc ?? (typeof document === 'undefined' ? undefined : document);
    if (!doc) return;
    const body = stacks.read(getNg() as IonicDebugApi | undefined, doc);
    if (!body) {
      // Ionic left the page (an app torn down): the server forgets it.
      if (sent) forget();
      return;
    }
    const report: IonicReport = {
      pageId,
      url: redactUrl(read(() => location.pathname + location.search, '')),
      title: redactMessage(read(() => doc.title, '')),
      ...body,
    };
    const json = JSON.stringify(report);
    if (!force && json === lastJson && !keepaliveDue(sentAt, tickMs())) return;
    lastJson = json;
    sentAt = Date.now();
    try {
      await my.rpc.call('push-ionic', report);
      sent = true;
    } catch {
      lastJson = '';
    }
  };

  const stacks = new IonicStacks(() => {
    clearTimeout(timer);
    timer = setTimeoutOutside(() => void push(), 50);
  });

  const forget = () => {
    sent = false;
    lastJson = '';
    void my.rpc.call('forget-ionic-page', pageId).catch(() => {});
  };

  return {
    push,
    leave() {
      if (left) return;
      left = true;
      clearTimeout(timer);
      if (sent) forget();
    },
    resume() {
      left = false;
      lastJson = '';
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      stacks.stop();
    },
  };
}
