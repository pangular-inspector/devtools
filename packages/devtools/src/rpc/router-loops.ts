import type { NavigationRecord } from '../router.ts';
import type { RouteNode } from '../router-config.ts';
import { code } from './forms-tools.ts';

export interface LoopHop {
  id: number;
  from: string;
  to: string;
  via: string;
  by?: string;
}

export interface NavigationLoop {
  kind: 'redirect' | 'burst' | 'config';
  ids: number[];
  cycle: string[];
  hops: LoopHop[];
  guards: string[];
  bounces: number;
  end: string;
}

interface Step {
  url: string;
  nav: NavigationRecord;
  hop?: LoopHop;
}

const BURST_GAP_MS = 500;
const MAX_STEPS = 120;
const AUTOMATIC = /^(navigate|navigateByUrl)\(\)/;

function walk(
  nodes: RouteNode[] | undefined,
  visit: (node: RouteNode, parents: RouteNode[]) => void,
  parents: RouteNode[] = [],
) {
  for (const node of nodes ?? []) {
    visit(node, parents);
    walk(node.children, visit, [...parents, node]);
  }
}

function pathOf(url: string): string {
  return url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

function keyOf(url: string): string {
  const [path, query] = url.split('#')[0].split('?');
  return `${path.replace(/\/+$/, '') || '/'}${query ? `?${query}` : ''}`;
}

/**
 * Cycles among the static redirectTo strings of the config, each as the list
 * of paths it visits, first and last the same.
 */
export function redirectCycles(config: RouteNode[]): string[][] {
  const edges = new Map<string, string>();
  walk(config, (node, parents) => {
    if (typeof node.redirectTo !== 'string' || node.redirectTo.startsWith('function ')) return;
    if (/:/.test(node.path) || node.path === '**') return;
    const base = parents.length ? parents[parents.length - 1].fullPath : '';
    const target = node.redirectTo.startsWith('/')
      ? node.redirectTo
      : `${base.replace(/\/$/, '')}/${node.redirectTo}`;
    edges.set(pathOf(node.fullPath), pathOf(target));
  });
  const cycles: string[][] = [];
  for (const start of edges.keys()) {
    const seen = [start];
    let cursor = edges.get(start);
    while (cursor && seen.length < 20) {
      if (cursor === start) {
        if (seen.every((node) => node >= start)) cycles.push([...seen, start]);
        break;
      }
      if (seen.includes(cursor)) break;
      seen.push(cursor);
      cursor = edges.get(cursor);
    }
  }
  return cycles;
}

function configRedirect(config: RouteNode[] | undefined, url: string): string | undefined {
  const segments = pathOf(url).split('/').filter(Boolean);
  let found: string | undefined;
  walk(config, (node) => {
    if (found || node.redirectTo === undefined || node.outlet) return;
    const own = node.fullPath.split('/').filter(Boolean);
    if (own.includes('**')) return;
    const full = node.pathMatch === 'full' || node.path === '';
    if (full ? own.length !== segments.length : own.length > segments.length) return;
    if (own.every((part, i) => part.startsWith(':') || part === segments[i])) {
      found = `redirectTo: '${node.redirectTo}' on ${node.fullPath}`;
    }
  });
  return found;
}

function redirectRun(nav: NavigationRecord) {
  return (
    nav.runs?.find((run) => /^(UrlTree|RedirectCommand)/.test(run.result)) ??
    nav.runs?.find((run) => run.kind !== 'resolve' && run.result === 'false')
  );
}

function redirectCause(source: NavigationRecord): string | undefined {
  const run = redirectRun(source);
  if (run) return `${run.guard} (${run.kind} on ${run.route})`;
  if (source.redirectKind === 'error handler') return 'the navigation error handler';
  const names = source.guards?.names ?? [];
  if (names.length === 1) return names[0];
  if (names.length > 1) return `one of ${names.join(', ')}`;
  return undefined;
}

function isAutomatic(nav: NavigationRecord): boolean {
  if (nav.probe || nav.trigger !== 'imperative') return false;
  return !!nav.caller && AUTOMATIC.test(nav.caller);
}

function continues(prev: NavigationRecord, nav: NavigationRecord, ids: Set<number>): boolean {
  if (nav.redirectedFrom !== undefined && ids.has(nav.redirectedFrom)) return true;
  if (prev.beforeConnect || nav.beforeConnect || !isAutomatic(nav)) return false;
  return nav.startedAt - (prev.endedAt ?? prev.startedAt) <= BURST_GAP_MS;
}

function sequencesOf(navigations: NavigationRecord[]): NavigationRecord[][] {
  const out: NavigationRecord[][] = [];
  let current: NavigationRecord[] = [];
  let ids = new Set<number>();
  for (const nav of navigations) {
    if (nav.id < 0) continue;
    const prev = current[current.length - 1];
    if (prev && continues(prev, nav, ids)) {
      current.push(nav);
      ids.add(nav.id);
      continue;
    }
    if (current.length > 1) out.push(current);
    current = [nav];
    ids = new Set([nav.id]);
  }
  if (current.length > 1) out.push(current);
  return out;
}

function stepsOf(sequence: NavigationRecord[], config?: RouteNode[]): Step[] {
  const steps: Step[] = [];
  const last = () => steps[steps.length - 1];
  sequence.forEach((nav, i) => {
    const prev = sequence[i - 1];
    if (!prev) {
      steps.push({ url: nav.url, nav });
    } else {
      const source = sequence.find((n) => n.id === nav.redirectedFrom);
      const hop: LoopHop = source
        ? {
            id: source.id,
            from: last().url,
            to: nav.url,
            via: source.redirectKind ?? 'guard',
            by: redirectCause(source),
          }
        : {
            id: nav.id,
            from: last().url,
            to: nav.url,
            via: 'navigate',
            by: nav.caller,
          };
      steps.push({ url: nav.url, nav, hop });
    }
    if (nav.finalUrl && keyOf(nav.finalUrl) !== keyOf(nav.url)) {
      steps.push({
        url: nav.finalUrl,
        nav,
        hop: {
          id: nav.id,
          from: nav.url,
          to: nav.finalUrl,
          via: 'redirectTo',
          by: configRedirect(config, nav.url),
        },
      });
    }
  });
  const tail = sequence[sequence.length - 1];
  if (tail.outcome === 'redirected' && tail.redirectTo) {
    steps.push({
      url: tail.redirectTo,
      nav: tail,
      hop: {
        id: tail.id,
        from: last().url,
        to: tail.redirectTo,
        via: tail.redirectKind ?? 'guard',
        by: redirectCause(tail),
      },
    });
  }
  return steps.slice(0, MAX_STEPS);
}

function endOf(nav: NavigationRecord): string {
  switch (nav.outcome) {
    case 'succeeded':
      return `settled on ${nav.finalUrl ?? nav.url}`;
    case 'pending':
      return 'still running';
    case 'failed':
      return `failed${nav.errorCode ? ` with ${nav.errorCode}` : ''}`;
    case 'redirected':
      return nav.redirectTo
        ? `redirected to ${nav.redirectTo}; the next navigation was not recorded`
        : 'redirected';
    default:
      return `${nav.outcome}${nav.code ? ` (${nav.code})` : ''}`;
  }
}

function guardsOf(hops: LoopHop[], navs: NavigationRecord[]): string[] {
  const names = new Set<string>();
  for (const nav of navs) {
    const run = redirectRun(nav);
    if (run) names.add(run.guard);
  }
  if (!names.size) {
    for (const hop of hops) {
      if (hop.via === 'guard' || hop.via === 'canMatch') {
        const nav = navs.find((n) => n.id === hop.id);
        for (const name of nav?.guards?.names ?? []) names.add(name);
      }
    }
  }
  return [...names];
}

function firstLoop(sequence: NavigationRecord[], config?: RouteNode[]): NavigationLoop | undefined {
  const steps = stepsOf(sequence, config);
  const seen = new Map<string, number>();
  for (let j = 0; j < steps.length; j++) {
    const key = keyOf(steps[j].url);
    const i = seen.get(key);
    if (i === undefined) {
      seen.set(key, j);
      continue;
    }
    if (j - i < 2 && steps[j].hop?.via === 'navigate') {
      seen.set(key, j);
      continue;
    }
    const cycle = steps.slice(i, j + 1);
    const hops = cycle.slice(1).map((step) => step.hop!);
    const first = sequence.indexOf(steps[i].nav);
    const navs = sequence.slice(first);
    const cycleEnd = sequence.indexOf(steps[j].nav);
    const cycleNavs = sequence.slice(first, cycleEnd + 1);
    const bounces = steps.slice(i + 1).filter((step) => keyOf(step.url) === key).length;
    return {
      kind: hops.every((hop) => hop.via !== 'navigate') ? 'redirect' : 'burst',
      ids: navs.map((nav) => nav.id),
      cycle: cycle.map((step) => step.url),
      hops,
      guards: guardsOf(hops, cycleNavs),
      bounces,
      end: endOf(sequence[sequence.length - 1]),
    };
  }
  return undefined;
}

function configLoop(nav: NavigationRecord, config?: RouteNode[]): NavigationLoop {
  const target = nav.reason?.match(/to '([^']+)'/)?.[1];
  const path = pathOf(nav.url);
  const cycles = config ? redirectCycles(config) : [];
  const match =
    cycles.find((cycle) => cycle.includes(path)) ??
    cycles.find((cycle) => target !== undefined && cycle.includes(pathOf(target)));
  const base = match ? match.slice(0, -1) : [nav.url, target ?? '?'];
  const at = Math.max(0, base.indexOf(path));
  const cycle = [...base.slice(at), ...base.slice(0, at)];
  cycle.push(cycle[0]);
  const hops = cycle.slice(1).map((to, i) => ({
    id: nav.id,
    from: cycle[i],
    to,
    via: 'redirectTo',
    by: configRedirect(config, cycle[i]),
  }));
  return {
    kind: 'config',
    ids: [nav.id],
    cycle,
    hops,
    guards: [],
    bounces: 0,
    end: endOf(nav),
  };
}

/**
 * Loops in the recorded navigations: a redirect chain (guard, resolver,
 * canMatch or error handler redirects, followed through redirectedFrom, plus
 * the config redirectTo inside each navigation) or a burst of navigations
 * that code started right after each other, that visits the same URL twice;
 * and navigations Angular stopped with NG04016 (a redirectTo loop).
 */
export function detectLoops(
  navigations: NavigationRecord[],
  config?: RouteNode[],
): NavigationLoop[] {
  const loops: NavigationLoop[] = [];
  for (const sequence of sequencesOf(navigations)) {
    const loop = firstLoop(sequence, config);
    if (loop) loops.push(loop);
  }
  for (const nav of navigations) {
    if (nav.errorCode === 'NG04016' && !loops.some((loop) => loop.ids.includes(nav.id))) {
      loops.push(configLoop(nav, config));
    }
  }
  return loops;
}

export function loopChain(loop: NavigationLoop): string {
  return loop.cycle.map(code).join(' → ');
}

export function hopText(hop: LoopHop): string {
  const route = `${code(hop.from)} → ${code(hop.to)}`;
  if (hop.via === 'navigate')
    return `${route}: #${hop.id} started by ${hop.by ? code(hop.by) : 'code'}`;
  const via =
    hop.via === 'redirectTo' ? (hop.by ? 'config' : 'config redirectTo') : `${hop.via} redirect`;
  return `${route}: ${via}${hop.by ? ` ${code(hop.by)}` : ''} in #${hop.id}`;
}

export function loopTitle(loop: NavigationLoop): string {
  return loop.kind === 'burst' ? 'navigation loop' : 'redirect loop';
}

export function loopSummary(loop: NavigationLoop): string {
  const ids =
    loop.ids.length > 1 ? `#${loop.ids[0]}–#${loop.ids[loop.ids.length - 1]}` : `#${loop.ids[0]}`;
  const bounced = loop.bounces > 1 ? `, came back ${loop.bounces} times` : '';
  return `${loopChain(loop)} (${ids}${bounced}; ${loop.end})`;
}

export function describeLoop(loop: NavigationLoop): string {
  const lines = [`- **${loopTitle(loop)}** ${loopSummary(loop)}`];
  for (const hop of loop.hops) lines.push(`  - ${hopText(hop)}`);
  if (loop.guards.length) lines.push(`  - guards involved: ${loop.guards.map(code).join(', ')}`);
  return lines.join('\n');
}
