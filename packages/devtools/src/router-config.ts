import {
  MAX_DEPTH,
  clip,
  componentName,
  configsOf,
  guardsOf,
  nameOf,
  read,
  resolversOf,
  type AnyRecord,
  type RouteGuards,
} from './router.ts';

export interface RouteNode {
  id: string;
  path: string;
  fullPath: string;
  kind: 'component' | 'redirect' | 'children' | 'lazy' | 'componentless';
  component?: string;
  redirectTo?: string;
  pathMatch?: string;
  outlet?: string;
  lazy?: 'unloaded' | 'loaded';
  matcher?: string;
  guards?: RouteGuards;
  resolvers?: string[];
  title?: string;
  dataKeys?: string[];
  providers?: number;
  runGuardsAndResolvers?: string;
  inputs?: string[];
  classGuards?: string[];
  children?: RouteNode[];
}

const MAX_NODES = 1000;
const MAX_SIBLINGS = 200;

function joinPath(parent: string, path: string): string {
  const joined = [parent.replace(/\/$/, ''), path].filter((part) => part !== '').join('/');
  return joined.startsWith('/') ? joined : `/${joined}`;
}

function isClassGuard(entry: unknown): boolean {
  return (
    typeof entry === 'function' &&
    read(() => {
      const proto = (entry as AnyRecord)['prototype'];
      return (
        !!proto &&
        ['canActivate', 'canActivateChild', 'canDeactivate', 'canMatch', 'canLoad', 'resolve'].some(
          (method) => typeof proto[method] === 'function',
        )
      );
    }, false)
  );
}

function inputsOf(component: unknown): string[] | undefined {
  const inputs = read(() => (component as AnyRecord)?.['ɵcmp']?.['inputs'] as AnyRecord, null);
  if (!inputs) return undefined;
  const names = Object.keys(inputs);
  return names.length ? names.slice(0, 50) : undefined;
}

function titleOf(title: unknown): string | undefined {
  if (title === undefined || title === null) return undefined;
  if (typeof title === 'string') return clip(title, 200);
  return `resolver ${nameOf(title)}`;
}

function redirectOf(redirectTo: unknown): string | undefined {
  if (redirectTo === undefined) return undefined;
  if (typeof redirectTo === 'string') return redirectTo;
  return `function ${nameOf(redirectTo)}`;
}

function subtreeSize(route: AnyRecord, depth: number): number {
  if (depth > MAX_DEPTH) return 0;
  const nested = [
    ...read(() => (route['children'] as AnyRecord[] | undefined) ?? [], []),
    ...read(() => (route['_loadedRoutes'] as AnyRecord[] | undefined) ?? [], []),
  ];
  return nested.reduce((total, child) => total + subtreeSize(child, depth + 1), 1);
}

/**
 * The router's live configuration: every route with lazy children merged in
 * once they load, and the routes of the current navigation marked active.
 * Each level keeps its first 200 routes and the whole walk its first 1000;
 * `cut.routes` counts the routes left out, with their descendants.
 */
export function walkConfig(router: AnyRecord, cut = { routes: 0 }): RouteNode[] {
  let count = 0;
  const visit = (
    routes: AnyRecord[],
    parent: string,
    prefix: string,
    depth: number,
  ): RouteNode[] => {
    if (!Array.isArray(routes)) return [];
    if (depth > MAX_DEPTH) {
      cut.routes += routes.reduce((total, route) => total + subtreeSize(route, 0), 0);
      return [];
    }
    const out: RouteNode[] = [];
    routes.forEach((route, index) => {
      if (index >= MAX_SIBLINGS || ++count > MAX_NODES) {
        cut.routes += subtreeSize(route, depth);
        return;
      }
      const path = read(() => String(route['path'] ?? ''), '');
      const id = prefix ? `${prefix}.${index}` : String(index);
      const fullPath = joinPath(parent, path);
      const component = read(() => route['component'] ?? route['_loadedComponent'], undefined);
      const loadedRoutes = read(() => route['_loadedRoutes'] as AnyRecord[] | undefined, undefined);
      const children = read(() => route['children'] as AnyRecord[] | undefined, undefined);
      const lazyChildren = read(() => !!route['loadChildren'], false);
      const lazyComponent = read(() => !!route['loadComponent'], false);
      const redirectTo = redirectOf(read(() => route['redirectTo'], undefined));
      const node: RouteNode = {
        id,
        path,
        fullPath,
        kind:
          redirectTo !== undefined
            ? 'redirect'
            : lazyChildren
              ? 'lazy'
              : component || lazyComponent
                ? 'component'
                : children
                  ? 'children'
                  : 'componentless',
      };
      if (component) node.component = componentName(component);
      if (redirectTo !== undefined) node.redirectTo = redirectTo;
      const pathMatch = read(() => route['pathMatch'] as string | undefined, undefined);
      if (pathMatch) node.pathMatch = pathMatch;
      const outlet = read(() => route['outlet'] as string | undefined, undefined);
      if (outlet && outlet !== 'primary') node.outlet = outlet;
      if (lazyChildren) node.lazy = loadedRoutes ? 'loaded' : 'unloaded';
      else if (lazyComponent) node.lazy = component ? 'loaded' : 'unloaded';
      const matcher = read(() => route['matcher'], undefined);
      if (matcher) node.matcher = nameOf(matcher);
      const guards = guardsOf(route);
      if (guards) node.guards = guards;
      const classGuards = [
        'canActivate',
        'canActivateChild',
        'canDeactivate',
        'canMatch',
        'canLoad',
      ]
        .flatMap((kind) => read(() => (route[kind] as unknown[]) ?? [], []))
        .filter(isClassGuard)
        .map(nameOf);
      if (classGuards.length) node.classGuards = classGuards;
      const resolvers = resolversOf(route);
      if (resolvers) node.resolvers = resolvers;
      const title = titleOf(read(() => route['title'], undefined));
      if (title) node.title = title;
      const dataKeys = Object.keys(read(() => route['data'] ?? {}, {}));
      if (dataKeys.length) node.dataKeys = dataKeys.slice(0, 20);
      const providers = read(() => (route['providers'] as unknown[])?.length ?? 0, 0);
      if (providers) node.providers = providers;
      const rgr = read(() => route['runGuardsAndResolvers'], undefined);
      if (rgr) node.runGuardsAndResolvers = typeof rgr === 'string' ? rgr : 'function';
      const inputs = inputsOf(component);
      if (inputs) node.inputs = inputs;
      const nested = [...(children ?? []), ...(loadedRoutes ?? [])];
      if (nested.length) node.children = visit(nested, fullPath, id, depth + 1);
      out.push(node);
    });
    return out;
  };
  return visit(
    read(() => router['config'] as AnyRecord[], []),
    '',
    '',
    0,
  );
}

/**
 * Ids (as in walkConfig) of the routes the current navigation activated.
 */
export function activeIds(router: AnyRecord): string[] {
  const active = new Set(configsOf(read(() => router['routerState']['snapshot'], null)));
  const out: string[] = [];
  const visit = (routes: AnyRecord[], prefix: string, depth: number) => {
    if (!Array.isArray(routes) || depth > MAX_DEPTH) return;
    routes.forEach((route, index) => {
      const id = prefix ? `${prefix}.${index}` : String(index);
      if (active.has(route)) out.push(id);
      const nested = [
        ...read(() => (route['children'] as AnyRecord[]) ?? [], []),
        ...read(() => (route['_loadedRoutes'] as AnyRecord[]) ?? [], []),
      ];
      if (nested.length) visit(nested, id, depth + 1);
    });
  };
  visit(
    read(() => router['config'] as AnyRecord[], []),
    '',
    0,
  );
  return out;
}

/**
 * Counts config changes: a new config array (resetConfig, HMR) or a lazy
 * route whose children or component finished loading.
 */
export function configSignature(router: AnyRecord): string {
  const config = read(() => router['config'] as AnyRecord[], []);
  let loaded = 0;
  let total = 0;
  const visit = (routes: AnyRecord[], depth: number) => {
    if (!Array.isArray(routes) || depth > MAX_DEPTH || total > MAX_NODES) return;
    for (const route of routes) {
      total++;
      if (read(() => !!route['_loadedRoutes'] || !!route['_loadedComponent'], false)) loaded++;
      visit(
        read(() => route['children'] as AnyRecord[], []),
        depth + 1,
      );
      visit(
        read(() => route['_loadedRoutes'] as AnyRecord[], []),
        depth + 1,
      );
    }
  };
  visit(config, 0);
  return `${total}:${loaded}`;
}

export class ConfigTracker {
  generation = 0;
  private lastConfig: unknown = null;
  private lastSignature = '';

  update(router: AnyRecord): boolean {
    const config = read(() => router['config'], null);
    const signature = configSignature(router);
    if (config === this.lastConfig && signature === this.lastSignature) return false;
    this.lastConfig = config;
    this.lastSignature = signature;
    this.generation++;
    return true;
  }
}
