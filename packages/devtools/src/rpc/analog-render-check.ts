// Render mode check: requests a page from the dev server the way a browser
// does (`Accept: text/html`) and compares what came back with the mode the
// config gives the route.

import { DEVTOOLS_HEADER, devOrigin } from '../analog-server-log.ts';
import { redactHeaders } from '../http-redact.ts';
import { modeOf, type RenderMode } from './analog-tools.ts';
import type { AnalogProject } from './analog-scan.ts';

export interface RenderCheck {
  path: string;
  configured: RenderMode;
  reason: string;
  observed?: RenderMode;
  status?: number;
  ms?: number;
  /** The headers that decide the mode, masked. */
  headers: Record<string, string>;
  /** Whether the response fits the configured mode on the dev server. */
  matches?: boolean;
  note?: string;
  error?: string;
}

const CHECK_TIMEOUT_MS = 10_000;
const HEADERS = [
  'cache-control',
  'x-nitro-prerender',
  'x-analog-no-ssr',
  'location',
  'content-type',
  'age',
];

function isCaching(value: string): boolean {
  return (
    /(s-maxage|max-age)=\d*[1-9]|stale-while-revalidate/i.test(value) &&
    !/no-store|private/i.test(value)
  );
}

/** What a response says about how the page was rendered. */
export function observedMode(
  status: number,
  headers: Record<string, string>,
  html: string,
): RenderMode {
  if (status >= 300 && status < 400 && headers['location']) return 'redirect';
  if (headers['x-nitro-prerender']) return 'ssg';
  if (headers['x-analog-no-ssr'] === 'true' || !html.includes('ng-server-context')) {
    return 'client';
  }
  if (isCaching(headers['cache-control'] ?? '')) return 'cached';
  return 'ssr';
}

/** Whether `observed` is what the dev server serves for a route configured as `configured`. */
export function fitsInDev(configured: RenderMode, observed: RenderMode): boolean {
  if (configured === observed) return true;
  // The dev server never prerenders: a prerendered route is rendered per request.
  if (configured === 'ssg' && observed === 'ssr') return true;
  return false;
}

/** Path params replaced with a sample value, so a dynamic route can be requested. */
export function samplePath(pattern: string): string {
  return pattern.replace(/:(\w+)/g, '1').replace(/\*\*$/, 'x');
}

export async function checkRenderMode(
  project: AnalogProject,
  path: string,
  origin = devOrigin(),
): Promise<RenderCheck> {
  const { mode, reason } = modeOf(project, path);
  const check: RenderCheck = { path, configured: mode, reason, headers: {} };
  if (!origin) {
    return {
      ...check,
      error:
        'The dev server address is unknown. This works only through the pangular() Vite plugin.',
    };
  }
  const started = performance.now();
  try {
    const response = await fetch(`${origin}${samplePath(path)}`, {
      headers: { accept: 'text/html', [DEVTOOLS_HEADER]: '1' },
      redirect: 'manual',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    const html = (await response.text()).slice(0, 200_000);
    const all = Object.fromEntries(response.headers);
    const headers = redactHeaders(
      Object.fromEntries(HEADERS.filter((h) => all[h] !== undefined).map((h) => [h, all[h]])),
    );
    const observed = observedMode(response.status, headers, html);
    const matches = fitsInDev(mode, observed);
    const result: RenderCheck = {
      ...check,
      observed,
      status: response.status,
      ms: Math.round(performance.now() - started),
      headers,
      matches,
    };
    if (mode === 'ssg' && observed === 'ssr') {
      result.note =
        'The dev server renders prerendered routes per request; check the build output for the static file.';
    } else if (!matches) {
      result.note = `The config says ${mode}, but the dev server answered as ${observed}.`;
    }
    return result;
  } catch (error) {
    return { ...check, error: String((error as Error)?.message ?? error).slice(0, 300) };
  }
}
