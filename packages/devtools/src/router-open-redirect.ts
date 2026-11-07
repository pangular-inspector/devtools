import type { GuardRun } from './router.ts';
import { clip } from './text.ts';

/**
 * A navigation whose target came from a query param of the URL it was
 * started from or redirected away from, such as a guard that sends
 * `/login?returnUrl=/admin` to `/admin`. A target an attacker can choose is
 * an open redirect risk once the app passes it on without an allow list.
 */
export interface QueryRedirect {
  /** The query param the target was read from. */
  param: string;
  /** Who navigated: the guard or resolver, the error handler, or the calling code. */
  by: string;
}

/** Query param names that usually hold a URL to go to next. */
const RETURN_PARAM = /return|redirect|next|url|back|continue|goto|target|dest/i;

function decode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}

function queryPairs(url: string): [string, string][] {
  const query = url.split('#')[0].split('?').slice(1).join('?');
  if (!query) return [];
  return query
    .split('&')
    .filter(Boolean)
    .slice(0, 50)
    .map((pair): [string, string] => {
      const [key, ...rest] = pair.split('=');
      return [decode(key), decode(rest.join('='))];
    });
}

/** `/a/b?x#y` and `https://host/a/b` both as `/a/b?x#y`, for comparing a target with a param value. */
function comparable(url: string): string {
  const trimmed = url.trim();
  const withoutOrigin = trimmed
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '')
    .replace(/^\/\/[^/]+/, '');
  return withoutOrigin.startsWith('/') ? withoutOrigin : `/${withoutOrigin}`;
}

/**
 * The query param of `from` whose value is `target`, or undefined. A target
 * of `/` alone never counts. With `named`, only params whose name reads like
 * a return URL (`returnUrl`, `redirect`, `next` and the like) count.
 */
export function queryParamFor(from: string, target: string, named = false): string | undefined {
  const goal = comparable(target);
  if (goal.length < 2 || goal.includes('[redacted]')) return undefined;
  for (const [key, value] of queryPairs(from)) {
    if (!value || (named && !RETURN_PARAM.test(key))) continue;
    if (comparable(value) === goal) return key;
  }
  return undefined;
}

/** The guard or resolver run that returned the redirect, as `name (kind)`. */
export function redirectingRun(runs: GuardRun[] | undefined): string | undefined {
  const run = runs?.find((r) => /^(UrlTree|RedirectCommand)/.test(r.result));
  return run ? `${run.guard} (${run.kind})` : undefined;
}

/**
 * A guard, resolver or error handler redirect from `url` to `target` whose
 * target is one of the query params of `url`. Any param name counts: the
 * value matching the redirect exactly is the evidence.
 */
export function redirectFromQuery(
  url: string,
  target: string,
  kind: string | undefined,
  runs: GuardRun[] | undefined,
): QueryRedirect | undefined {
  const param = queryParamFor(url, target);
  if (!param) return undefined;
  return {
    param: clip(param, 100),
    by: clip(redirectingRun(runs) ?? `${kind ?? 'router'} redirect`, 200),
  };
}

/**
 * Code that navigated from `from` to `url`, where `url` is the value of a
 * return-URL query param of `from`. Clicked links don't count: their target
 * is written in the template.
 */
export function navigationFromQuery(
  from: string | undefined,
  url: string,
  caller: string | undefined,
): QueryRedirect | undefined {
  if (!from || caller?.startsWith('RouterLink')) return undefined;
  const param = queryParamFor(from, url, true);
  return param
    ? { param: clip(param, 100), by: clip(caller ?? 'navigate() from app code', 200) }
    : undefined;
}
