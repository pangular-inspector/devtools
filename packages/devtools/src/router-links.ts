import {
  clip,
  componentName,
  configSecretsFor,
  fullPathOf,
  read,
  redactUrl,
  type AnyRecord,
  type RouterDebugApi,
} from './router.ts';
import { elementId } from './element-id.ts';
import { serialize } from './serialize.ts';

export interface OutletInfo {
  outlet: string;
  route?: string;
  component?: string;
  element?: string;
  devtoolsId?: string;
  activated: boolean;
  detached?: boolean;
  inputs?: { input: string; source: string }[];
  data?: string;
  children?: OutletInfo[];
}

export interface LinkInfo {
  text: string;
  href?: string;
  active?: boolean;
  linkActive?: boolean;
  activeClasses?: string[];
  exact?: boolean;
  ariaCurrent?: string;
  element?: string;
  devtoolsId?: string;
}

const MAX_OUTLETS = 100;
const MAX_LINKS = 100;
/**
 * Candidate elements asked for their directives per scan. Each check is an
 * `ng.getDirectives` call, and a scan runs after every DOM change.
 */
export const MAX_LINK_CANDIDATES = 2000;
const MAX_DATA_PREVIEW = 300;

function outletData(outlet: AnyRecord | null): string | undefined {
  const value = read(() => {
    const data = outlet?.['routerOutletData'];
    return typeof data === 'function' ? (data as () => unknown)() : undefined;
  }, undefined);
  if (value === undefined) return undefined;
  const preview = serialize(value, { depth: 3, keys: 20, items: 20, text: 200, budget: 200 });
  return clip(JSON.stringify(preview) ?? String(preview), MAX_DATA_PREVIEW);
}

function elementOf(outlet: AnyRecord | null): Element | null {
  return read(
    () => (outlet?.['activated']?.['location']?.['nativeElement'] as Element) ?? null,
    null,
  );
}

function boundInputs(
  component: unknown,
  snapshot: AnyRecord | null,
): OutletInfo['inputs'] | undefined {
  const inputs = read(() => (component as AnyRecord)?.['ɵcmp']?.['inputs'] as AnyRecord, null);
  if (!inputs || !snapshot) return undefined;
  const params = read(() => (snapshot['params'] as AnyRecord) ?? {}, {});
  const query = read(() => (snapshot['queryParams'] as AnyRecord) ?? {}, {});
  const data = read(() => (snapshot['data'] as AnyRecord) ?? {}, {});
  const out = Object.keys(inputs).map((input) => ({
    input,
    source: input in data ? 'data' : input in params ? 'param' : input in query ? 'query' : 'unset',
  }));
  return out.length ? out.slice(0, 40) : undefined;
}

/**
 * The router's outlet tree from its root ChildrenOutletContexts: which route
 * and component each outlet shows, and with input binding, where each input
 * of the routed component gets its value.
 */
export function outletsOf(router: AnyRecord): OutletInfo[] {
  const bindingOn = read(() => !!router['componentInputBindingEnabled'], false);
  let count = 0;
  const visit = (contexts: AnyRecord | null, depth: number): OutletInfo[] => {
    const map = read(() => contexts?.['contexts'] as Map<string, AnyRecord>, null);
    if (!map || depth > 12) return [];
    const out: OutletInfo[] = [];
    for (const [name, context] of map) {
      if (++count > MAX_OUTLETS) break;
      const outlet = read(() => context['outlet'] as AnyRecord | null, null);
      const snapshot = read(() => context['route']?.['snapshot'] as AnyRecord, null);
      const activated = read(() => !!outlet?.['isActivated'], false);
      const info: OutletInfo = { outlet: name, activated };
      if (snapshot) info.route = fullPathOf(snapshot);
      if (activated) {
        const instance = read(() => outlet?.['component'], null);
        const type = read(() => (instance as AnyRecord)?.['constructor'], null);
        if (type) info.component = componentName(type);
        const element = elementOf(outlet);
        if (element) {
          info.element = element.tagName.toLowerCase();
          info.devtoolsId = elementId(element);
        }
        if (bindingOn) {
          const inputs = boundInputs(type, snapshot);
          if (inputs) info.inputs = inputs;
        }
      }
      const data = outletData(outlet);
      if (data !== undefined) info.data = data;
      if (read(() => !!context['attachRef'], false)) info.detached = true;
      const children = visit(
        read(() => context['children'] as AnyRecord, null),
        depth + 1,
      );
      if (children.length) info.children = children;
      out.push(info);
    }
    return out;
  };
  return visit(
    read(() => router['navigationTransitions']['rootContexts'] as AnyRecord, null),
    0,
  );
}

const MATCH_KEYS = ['paths', 'matrixParams', 'queryParams', 'fragment'];

export function matchOptionsOf(options: unknown): boolean | AnyRecord | null {
  if (options === null) return null;
  if (!options || typeof options !== 'object') return false;
  const record = options as AnyRecord;
  if (MATCH_KEYS.some((key) => !!record[key])) {
    return {
      paths: 'subset',
      matrixParams: 'ignored',
      queryParams: 'subset',
      fragment: 'ignored',
      ...record,
    };
  }
  return !!record['exact'];
}

export function isRouterLink(value: unknown): value is AnyRecord {
  return read(() => 'urlTree' in (value as AnyRecord) && !!(value as AnyRecord)['router'], false);
}

function isLinkActive(value: unknown): value is AnyRecord {
  return read(
    () =>
      'routerLinkActiveOptions' in (value as AnyRecord) &&
      typeof (value as AnyRecord)['isActive'] === 'boolean',
    false,
  );
}

/**
 * Elements that can carry RouterLink or RouterLinkActive. A property-bound
 * `[routerLink]` leaves no attribute in the DOM, but RouterLink writes `href`
 * on anchors (and custom elements that observe `href`) and `tabindex` on every
 * other host (`setTabIndexIfNotOnNativeEl` in @angular/router), so these
 * attributes find each live link without walking every element.
 */
const LINK_CANDIDATES =
  'a, area, button, [href], [tabindex], [routerlink], [routerLink], [routerlinkactive], [routerLinkActive]';

/**
 * RouterLink and RouterLinkActive directives on the page: where each link
 * points, whether the router considers it active and what RouterLinkActive
 * decided, so the two can be compared. Links past the first 100 are counted
 * in `cut.links` instead of listed. Only the first `MAX_LINK_CANDIDATES`
 * elements that could hold a link are checked; the rest are counted in
 * `cut.unchecked`, so `cut.links` is then a lower bound.
 */
export function linksOf(
  ng: RouterDebugApi,
  router: AnyRecord,
  cut: { links: number; unchecked?: number } = { links: 0 },
): LinkInfo[] {
  if (typeof document === 'undefined' || !ng.getDirectives) return [];
  const candidates = document.querySelectorAll(LINK_CANDIDATES);
  const checked = Math.min(candidates.length, MAX_LINK_CANDIDATES);
  cut.unchecked = candidates.length - checked;
  const out: LinkInfo[] = [];
  for (let i = 0; i < checked; i++) {
    const element = candidates[i];
    const directives = read(() => ng.getDirectives?.(element) ?? [], []);
    const link = directives.find(isRouterLink);
    const active = directives.find(isLinkActive);
    if (!link && !active) continue;
    if (out.length >= MAX_LINKS) {
      cut.links++;
      continue;
    }
    const info: LinkInfo = {
      text: clip((element.textContent ?? '').replace(/\s+/g, ' ').trim(), 60),
      element: element.tagName.toLowerCase(),
      devtoolsId: elementId(element),
    };
    const tree = read(() => link?.['urlTree'], null);
    if (tree) {
      const href = read(() => String(router['serializeUrl'](tree)), '');
      info.href = redactUrl(href, configSecretsFor(router, href));
      const match = read(() => matchOptionsOf(active?.['routerLinkActiveOptions']), false);
      info.active = match !== null && read(() => !!router['isActive'](tree, match), false);
    }
    if (active) {
      info.linkActive = read(() => !!active['isActive'], false);
      const classes = read(() => active['classes'] as string[], []);
      if (classes.length) info.activeClasses = classes.slice(0, 5);
      const options = read(() => active['routerLinkActiveOptions'] as AnyRecord, null);
      if (options && 'exact' in options) info.exact = !!options['exact'];
      else if (options && MATCH_KEYS.some((key) => !!options[key]))
        info.exact = options['paths'] === 'exact';
      const aria = read(() => active['ariaCurrentWhenActive'] as string | undefined, undefined);
      if (aria !== undefined) info.ariaCurrent = String(aria);
    }
    out.push(info);
  }
  return out;
}
