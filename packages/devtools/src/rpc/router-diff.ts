import type { NavigationRecord } from '../router.ts';
import type { MatchedRoute } from '../router-matched.ts';
import { code, UNTRUSTED } from './forms-tools.ts';
import {
  capped,
  freshness,
  noPage,
  otherPages,
  pickPage,
  type RouterState,
} from './router-tools.ts';
import type {
  DiffChange,
  DiffSection,
  NavigationDiff,
  NavigationDiffResult,
} from '../router-types.ts';
export type {
  DiffChange,
  DiffSection,
  NavigationDiff,
  NavigationDiffResult,
} from '../router-types.ts';

function queryOf(url: string | undefined): Record<string, string> {
  const query = url?.split('#')[0].split('?')[1];
  if (!query) return {};
  // No prototype, so keys such as `__proto__` or `constructor` stay plain keys.
  const out: Record<string, string> = Object.create(null);
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, ...rest] = pair.split('=');
    const decode = (text: string) => {
      try {
        return decodeURIComponent(text.replace(/\+/g, ' '));
      } catch {
        return text;
      }
    };
    out[decode(key)] = decode(rest.join('='));
  }
  return out;
}

function compareMaps(
  before: Record<string, string>,
  after: Record<string, string>,
  prefix = '',
): DiffChange[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  // Own keys only: a query key such as `constructor` must not read Object.prototype.
  return keys
    .map((key) => ({
      field: `${prefix}${key}`,
      before: Object.hasOwn(before, key) ? before[key] : undefined,
      after: Object.hasOwn(after, key) ? after[key] : undefined,
    }))
    .filter((change) => change.before !== change.after);
}

function routeKey(route: MatchedRoute): string {
  return route.outlet ? `${route.path} (outlet ${route.outlet})` : route.path;
}

function flatten(
  routes: MatchedRoute[] | undefined,
  pick: (route: MatchedRoute) => Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const route of routes ?? []) {
    for (const [key, value] of Object.entries(pick(route) ?? {})) {
      out[`${routeKey(route)} ${key}`] = value;
    }
  }
  return out;
}

function outletsOf(routes: MatchedRoute[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const route of routes ?? []) out[routeKey(route)] = route.component ?? '(no component)';
  return out;
}

function namesMap(names: string[] | undefined): Record<string, string> {
  return Object.fromEntries((names ?? []).map((name) => [name, 'yes']));
}

function guardVerdict(nav: NavigationRecord): string | undefined {
  const passed = nav.guards?.passed;
  if (passed === undefined) return undefined;
  return passed ? 'passed' : nav.outcome === 'redirected' ? 'redirected' : 'blocked';
}

function runsOf(nav: NavigationRecord, resolvers: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const run of nav.runs ?? []) {
    if ((run.kind === 'resolve') !== resolvers) continue;
    out[`${run.kind} ${run.guard} @ ${run.route}`] = run.result;
  }
  return out;
}

function msMap(nav: NavigationRecord): Record<string, string> {
  return Object.fromEntries(
    Object.entries(nav.phases ?? {}).map(([name, ms]) => [name, `${ms}ms`]),
  );
}

function compact(entries: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(entries).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

function summary(nav: NavigationRecord): Record<string, string> {
  return compact({
    url: nav.url,
    'final URL': nav.finalUrl,
    outcome: nav.outcome,
    code: nav.code,
    trigger: nav.trigger,
    'redirect to': nav.redirectTo,
    'redirect kind': nav.redirectKind,
    error: nav.errorCode,
  });
}

/**
 * What changed from navigation `a` to navigation `b`: the URL and outcome,
 * query params, route params and data per route, the routes and components
 * of every outlet, guard and resolver names and verdicts, phase timing, lazy
 * loads and the HTTP request count. Reads only the recorded data.
 */
export function diffNavigations(a: NavigationRecord, b: NavigationRecord): NavigationDiff {
  const notes: string[] = [];
  for (const nav of [a, b]) {
    if (!nav.routes) {
      notes.push(
        `#${nav.id} has no route data (${nav.outcome === 'succeeded' ? 'it ended before Pangular Inspector recorded routes, or happened before it connected' : `it ${nav.outcome}, so no route was activated`}), so params, data and outlets compare against nothing.`,
      );
    }
  }
  const timing = (nav: NavigationRecord) => msMap(nav);
  const candidates: DiffSection[] = [
    { title: 'Navigation', changes: compareMaps(summary(a), summary(b)) },
    {
      title: 'Query params',
      changes: compareMaps(queryOf(a.finalUrl ?? a.url), queryOf(b.finalUrl ?? b.url)),
    },
    {
      title: 'Route params',
      changes: compareMaps(
        flatten(a.routes, (r) => r.params),
        flatten(b.routes, (r) => r.params),
      ),
    },
    {
      title: 'Route data',
      changes: compareMaps(
        flatten(a.routes, (r) => r.data),
        flatten(b.routes, (r) => r.data),
      ),
    },
    {
      title: 'Outlets and components',
      changes: compareMaps(outletsOf(a.routes), outletsOf(b.routes)),
    },
    {
      title: 'Guards',
      changes: [
        ...compareMaps(namesMap(a.guards?.names), namesMap(b.guards?.names), 'ran: '),
        ...compareMaps(
          compact({ verdict: guardVerdict(a) }),
          compact({ verdict: guardVerdict(b) }),
        ),
        ...compareMaps(runsOf(a, false), runsOf(b, false)),
      ],
    },
    {
      title: 'Resolvers',
      changes: [
        ...compareMaps(namesMap(a.resolvers?.names), namesMap(b.resolvers?.names), 'ran: '),
        ...compareMaps(runsOf(a, true), runsOf(b, true)),
      ],
    },
    { title: 'Phase timing', changes: compareMaps(timing(a), timing(b)) },
    {
      title: 'Lazy loads and requests',
      changes: [
        ...compareMaps(namesMap(a.lazyLoaded), namesMap(b.lazyLoaded), 'lazy loaded: '),
        ...compareMaps(
          compact({ 'HTTP requests': a.requests ? String(a.requests.count) : undefined }),
          compact({ 'HTTP requests': b.requests ? String(b.requests.count) : undefined }),
        ),
      ],
    },
  ];
  return {
    a: a.id,
    b: b.id,
    sections: candidates.filter((section) => section.changes.length),
    same: candidates.filter((section) => !section.changes.length).map((s) => s.title),
    notes,
  };
}

function pathOf(url: string | undefined): string {
  return (url ?? '').split(/[?#]/)[0];
}

/**
 * The two navigations to compare. `b` defaults to the newest finished one
 * that is not a probe; `a` to the latest earlier one to the same path, else
 * the one just before `b`.
 */
export function pickNavigations(
  navigations: NavigationRecord[],
  a?: number,
  b?: number,
): { a: NavigationRecord; b: NavigationRecord } | { error: string } {
  const real = navigations.filter((nav) => !nav.probe);
  const second =
    b === undefined
      ? [...real].reverse().find((nav) => nav.outcome !== 'pending')
      : navigations.find((nav) => nav.id === b);
  if (!second) {
    return {
      error:
        b === undefined
          ? 'No finished navigation is recorded yet.'
          : `No navigation #${b} in the recent list.`,
    };
  }
  let first: NavigationRecord | undefined;
  if (a !== undefined) {
    first = navigations.find((nav) => nav.id === a);
    if (!first) return { error: `No navigation #${a} in the recent list.` };
  } else {
    const earlier = real.filter((nav) => nav !== second && nav.startedAt <= second.startedAt);
    const path = pathOf(second.finalUrl ?? second.url);
    first =
      [...earlier].reverse().find((nav) => pathOf(nav.finalUrl ?? nav.url) === path) ??
      earlier[earlier.length - 1];
    if (!first) return { error: `No navigation before #${second.id} to compare it with.` };
  }
  if (first === second) return { error: 'Pick two different navigations.' };
  return { a: first, b: second };
}

/** The diff for the panel: two navigations of one page, or why there is none. */
export function navigationDiffResult(
  state: RouterState,
  args: { page?: string; a?: number; b?: number },
): NavigationDiffResult {
  const page = pickPage(state, args.page);
  if (!page) return { error: 'No page reports router state.' };
  const picked = pickNavigations(page.navigations, args.a, args.b);
  if ('error' in picked) return picked;
  return diffNavigations(picked.a, picked.b);
}

function cell(value: string | undefined): string {
  return value === undefined ? '(none)' : code(value);
}

/** The diff as markdown for the `diff-navigations` agent tool. */
export function diffNavigationsText(
  state: RouterState,
  args: { page?: string; a?: number; b?: number },
  now = Date.now(),
): string {
  const page = pickPage(state, args.page);
  if (!page) return noPage(args.page, state);
  const picked = pickNavigations(page.navigations, args.a, args.b);
  if ('error' in picked) return `${picked.error}${otherPages(state, page)}${freshness(page, now)}`;
  const diff = diffNavigations(picked.a, picked.b);
  const lines = [
    `Comparing #${diff.a} ${code(picked.a.finalUrl ?? picked.a.url)} (${picked.a.outcome}) with #${diff.b} ${code(picked.b.finalUrl ?? picked.b.url)} (${picked.b.outcome}).`,
  ];
  if (!diff.sections.length) lines.push('', 'Nothing recorded differs between them.');
  for (const section of diff.sections) {
    lines.push('', `**${section.title}**`);
    for (const change of section.changes) {
      lines.push(`- ${change.field}: ${cell(change.before)} → ${cell(change.after)}`);
    }
  }
  if (diff.same.length) lines.push('', `Same in both: ${diff.same.join(', ')}.`);
  for (const note of diff.notes) lines.push('', `_${note}_`);
  return capped(
    `${UNTRUSTED}\n\n${lines.join('\n')}${otherPages(state, page)}${freshness(page, now)}`,
    'pass `a` and `b`',
  );
}
