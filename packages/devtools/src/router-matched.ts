import {
  chainOf,
  clip,
  componentName,
  fullPathOf,
  outletOf,
  read,
  redactRecord,
  type AnyRecord,
} from './router.ts';

/**
 * One route a navigation activated, kept on its record so two navigations
 * can be compared later. Params and data are redacted, and each value is
 * short JSON text, so the record stays small and comparable as strings.
 */
export interface MatchedRoute {
  /** Full path of the route config, such as `/users/:id`. */
  path: string;
  /** Left out for the primary outlet. */
  outlet?: string;
  component?: string;
  params?: Record<string, string>;
  data?: Record<string, string>;
}

/** Most routes one navigation keeps. */
export const MAX_MATCHED_ROUTES = 30;
const MAX_KEYS = 20;
const MAX_VALUE = 120;

function textMap(value: Record<string, unknown>): Record<string, string> | undefined {
  const entries = Object.entries(value)
    .slice(0, MAX_KEYS)
    .map(([key, item]): [string, string] => [
      clip(key, 100),
      clip(
        read(() => JSON.stringify(item) ?? String(item), String(item)),
        MAX_VALUE,
      ),
    ]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * The routes of an activated route tree (a `RouterStateSnapshot` root) with
 * a route config: every outlet, depth first, capped at
 * {@link MAX_MATCHED_ROUTES}. Values that look secret are masked.
 */
export function matchedRoutesOf(root: AnyRecord | null, secrets: string[] = []): MatchedRoute[] {
  const out: MatchedRoute[] = [];
  for (const route of chainOf(root)) {
    if (out.length >= MAX_MATCHED_ROUTES) break;
    const config = read(() => route['routeConfig'] as AnyRecord | null, null);
    if (!config) continue;
    const entry: MatchedRoute = { path: clip(fullPathOf(route), 300) };
    const outlet = outletOf(route);
    if (outlet !== 'primary') entry.outlet = outlet;
    const component = read(() => route['component'] ?? config['component'], undefined);
    if (component) entry.component = clip(componentName(component), 200);
    const params = textMap(
      redactRecord(
        read(() => route['params'], {}),
        secrets,
      ),
    );
    if (params) entry.params = params;
    const data = textMap(
      redactRecord(
        read(() => route['data'], {}),
        secrets,
      ),
    );
    if (data) entry.data = data;
    out.push(entry);
  }
  return out;
}
