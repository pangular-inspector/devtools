import {
  clearNavigations,
  componentName,
  droppedNavigations,
  findRouterRoots,
  read,
  setGeneration,
  snapshotRouter,
  type AnyRecord,
  type NavigationRecord,
  type RouterDebugApi,
} from './router.ts';
import { watchApp, type AppWatch } from './router-app-watch.ts';
import { ConfigTracker, activeIds, walkConfig, type RouteNode } from './router-config.ts';
import { linksOf, linksOfRouters, outletsOf } from './router-links.ts';
import { detectSetup, type RouterSetup } from './router-setup.ts';

import type { LinkInfo, OutletInfo, PreloadRecord, RouterAppReport } from './router-types.ts';
export type { RouterAppReport } from './router-types.ts';

/** Most apps one page reports. */
export const MAX_ROUTER_APPS = 8;

const appIds = new WeakMap<Element, string>();
// The root that holds each id, so a root that replaces a removed one (HMR,
// re-bootstrap) gets the same id back and the panel keeps its selection.
const holders = new Map<string, WeakRef<Element> | Element>();

function holderOf(id: string): Element | undefined {
  const held = holders.get(id);
  if (!held) return undefined;
  return typeof WeakRef === 'function' && held instanceof WeakRef
    ? held.deref()
    : (held as Element);
}

/** The id of an app root, kept in a `WeakMap`, so the app's DOM is never written to. */
export function appIdOf(root: Element): string {
  const known = appIds.get(root);
  if (known) return known;
  const base = (read(() => root.localName, '') || 'app').slice(0, 40);
  let id = base;
  for (let n = 2; ; n++) {
    const holder = holderOf(id);
    if (!holder || holder === root || !holder.isConnected) break;
    id = `${base}-${n}`;
  }
  holders.set(id, typeof WeakRef === 'function' ? new WeakRef(root) : root);
  appIds.set(root, id);
  return id;
}

function appNameOf(ng: RouterDebugApi, root: Element): string {
  const component = read(() => ng.getComponent?.(root) as AnyRecord | null, null);
  const name = component ? read(() => componentName(component['constructor']), '') : '';
  return (name && name !== 'Object' ? name : read(() => root.localName, '')) || 'App';
}

interface WatchedApp {
  id: string;
  name: string;
  selector: string;
  root: Element;
  router: AnyRecord;
  navigations: NavigationRecord[];
  preloads: PreloadRecord[];
  watch: AppWatch;
  outlets: OutletInfo[];
  links: LinkInfo[];
  linksTruncated: number;
  linksUnchecked: number;
  tracker: ConfigTracker;
  config?: RouteNode[];
  configTruncated: number;
  setup?: RouterSetup;
}

/**
 * The apps on a page that each have a Router. The overlay keeps watching the
 * first app as before; this watches every other app the same way (its router
 * events, callers, error handler, preloads and, when on, guard runs) and
 * describes each one, with its own outlets and links, in the report's `apps`
 * list. A page with one app reports no list, so its report stays as it was.
 */
export class RouterApps {
  private primary: { id: string; name: string; selector: string; root: Element } | null = null;
  private others: WatchedApp[] = [];
  private roots: Element[] = [];
  private instrumented = false;

  private readonly onChange: () => void;

  constructor(onChange: () => void, instrumented = false) {
    this.onChange = onChange;
    this.instrumented = instrumented;
  }

  /** Turns guard and resolver recording on or off in every app other than the first. */
  setInstrumented(on: boolean): void {
    this.instrumented = on;
    for (const app of this.others) app.watch.setInstrumented(on);
  }

  /**
   * The links of the first app, from one pass over the page that also files
   * every other app's links under that app. On a page with one app this is
   * `linksOf` as it always was. Reads each app's outlets too.
   */
  links(
    ng: RouterDebugApi,
    primary: AnyRecord,
    cut: { links: number; unchecked?: number },
  ): LinkInfo[] {
    this.dropGone();
    if (!this.primary || !this.others.length) return linksOf(ng, primary, cut);
    const cuts = this.others.map(() => ({ links: 0, unchecked: 0 }));
    const [first, ...rest] = linksOfRouters(
      ng,
      [primary, ...this.others.map((app) => app.router)],
      [cut, ...cuts],
    );
    this.others.forEach((app, index) => {
      app.links = rest[index];
      app.linksTruncated = cuts[index].links;
      app.linksUnchecked = cuts[index].unchecked;
      app.outlets = read(() => outletsOf(app.router), []);
    });
    return first;
  }

  /**
   * Finds the app of each Router reachable from `roots` and starts watching
   * the ones other than `primary`. Cheap when the roots did not change.
   */
  scan(ng: RouterDebugApi, roots: Element[], primary: AnyRecord, force = false): void {
    const live = roots.filter((root) => read(() => root.isConnected, false));
    this.dropGone();
    if (!force && sameList(live, this.roots)) return;
    this.roots = live;
    const found = findRouterRoots(ng, live).slice(0, MAX_ROUTER_APPS);
    const main = found.find((entry) => entry.router === primary);
    if (!main) {
      // A copy: drop() removes each app from this.others.
      // oxlint-disable-next-line unicorn/no-useless-spread
      for (const app of [...this.others]) this.drop(app);
      this.primary = null;
      return;
    }
    this.primary = {
      id: appIdOf(main.root),
      name: appNameOf(ng, main.root),
      selector: read(() => main.root.localName, ''),
      root: main.root,
    };
    const keep = new Set<AnyRecord>();
    for (const { router, root } of found) {
      if (router === primary) continue;
      keep.add(router);
      if (this.others.some((app) => app.router === router)) continue;
      const navigations: NavigationRecord[] = [];
      const preloads: PreloadRecord[] = [];
      this.others.push({
        id: appIdOf(root),
        name: appNameOf(ng, root),
        selector: read(() => root.localName, ''),
        root,
        router,
        navigations,
        preloads,
        watch: watchApp(ng, router, root, navigations, preloads, this.onChange, this.instrumented),
        outlets: read(() => outletsOf(router), []),
        links: [],
        linksTruncated: 0,
        linksUnchecked: 0,
        tracker: new ConfigTracker(),
        configTruncated: 0,
      });
    }
    for (const app of this.others.filter((other) => !keep.has(other.router))) this.drop(app);
  }

  /** The root element of the first app, or `fallback` on a page with one app. */
  primaryRoot(fallback: Element | null): Element | null {
    return this.others.length && this.primary ? this.primary.root : fallback;
  }

  /** How many apps with a Router the page has; 1 or 0 means no `apps` list. */
  get count(): number {
    return (this.primary ? 1 : 0) + this.others.length;
  }

  /** The `apps` list of the router report, or undefined on a page with one app. */
  report(ng: RouterDebugApi, routers: number): RouterAppReport[] | undefined {
    this.dropGone();
    if (!this.primary || !this.others.length) return undefined;
    const list: RouterAppReport[] = [
      {
        id: this.primary.id,
        name: this.primary.name,
        selector: this.primary.selector,
        primary: true,
      },
    ];
    for (const app of this.others) {
      if (app.tracker.update(app.router) || !app.config) {
        const cut = { routes: 0 };
        app.config = walkConfig(app.router, cut);
        app.configTruncated = cut.routes;
        app.setup = read(() => detectSetup(ng, app.router, routers, app.root), undefined);
        setGeneration(app.tracker.generation, app.router);
      }
      const entry: RouterAppReport = {
        id: app.id,
        name: app.name,
        selector: app.selector,
        snapshot: read(() => snapshotRouter(app.router), null),
        navigations: app.navigations,
        generation: app.tracker.generation,
        config: app.config,
        activeIds: read(() => activeIds(app.router), []),
        outlets: app.outlets,
        links: app.links,
        preloads: app.preloads,
      };
      if (app.linksTruncated) entry.linksTruncated = app.linksTruncated;
      if (app.linksUnchecked) entry.linksUnchecked = app.linksUnchecked;
      const dropped = droppedNavigations(app.navigations);
      if (dropped) entry.dropped = dropped;
      if (app.configTruncated) entry.configTruncated = app.configTruncated;
      if (app.setup) entry.setup = app.setup;
      list.push(entry);
    }
    return list;
  }

  /** The router and navigations of an app other than the first, for a page action. */
  target(appId: unknown): { router: AnyRecord; navigations: NavigationRecord[] } | null {
    if (typeof appId !== 'string') return null;
    const app = this.others.find((other) => other.id === appId);
    return app ? { router: app.router, navigations: app.navigations } : null;
  }

  /** True when `appId` names the first app, or no app at all is named. */
  isPrimary(appId: unknown): boolean {
    return appId === undefined || appId === null || appId === this.primary?.id;
  }

  /** Clears the navigations of every app other than the first. */
  clearNavigations(): void {
    for (const app of this.others) clearNavigations(app.navigations);
  }

  /** Stops watching every app, after the first app's router went away. */
  reset(): void {
    for (const app of this.others) app.watch.stop();
    this.others = [];
    this.primary = null;
    this.roots = [];
  }

  private dropGone(): void {
    for (const app of this.others.filter(
      (other) =>
        !read(() => other.root.isConnected, false) ||
        read(() => other.router['disposed'] === true, false),
    )) {
      this.drop(app);
      this.roots = [];
    }
  }

  private drop(app: WatchedApp): void {
    app.watch.stop();
    this.others = this.others.filter((other) => other !== app);
  }
}

function sameList(a: Element[], b: Element[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
