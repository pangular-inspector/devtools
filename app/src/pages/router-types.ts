import type { DevframeRpcClient } from 'devframe/client';
import { rpcTry } from '../rpc';
import type {
  NavigationCalls,
  RouteNode,
  RouterAppReport,
  RouterLintResult,
  RouterPage,
  ScannedRoute,
} from '@pangular-inspector/devtools/internal/types';

export type {
  ActiveRoute,
  DiffChange,
  GuardRun,
  LinkInfo,
  LintFinding,
  LoopHop,
  MatchedRoute,
  NavigationCalls,
  NavigationDiffResult,
  NavigationLoop,
  NavigationRecord,
  OutletInfo,
  PlatformNavigation,
  RouteNode,
  RoutePreview,
  RouterPage,
  RouterSetup,
} from '@pangular-inspector/devtools/internal/types';

/** A route from the source scan (`get-routes` RPC). */
export type SourceRoute = ScannedRoute;

/** Lint findings for the panel, or why no check could run (`router-lint` RPC). */
export type LintResult = RouterLintResult;

/** An HttpClient call as the `router-http` RPC returns it. */
export type TimelineCall = NavigationCalls['during'][number];

export function sourceLocation(source: SourceRoute): string {
  return source.line ? `${source.file}:${source.line}` : source.file;
}

export function sourceOf(node: RouteNode, sources: SourceRoute[]): SourceRoute | undefined {
  const candidates = sources.filter(
    (s) =>
      s.fullPath === node.fullPath &&
      (s.redirectTo !== undefined) === (node.redirectTo !== undefined),
  );
  return (
    candidates.find((s) => !!node.component && s.component === node.component) ??
    candidates.find((s) => !s.component || !node.component)
  );
}

/** One Angular app with its own Router on a page that runs several. */
export type RouterApp = RouterAppReport;

/** The apps of a page that runs more than one Angular app with a Router, else none. */
export function routerAppsOf(page: RouterPage | null | undefined): RouterApp[] {
  return page?.apps && page.apps.length > 1 ? page.apps : [];
}

/**
 * The page as one of its apps sees it, as the server builds it for the agent
 * tools: that app's route, navigations, config and setup in place of the first
 * app's. Outlets, links, preloads and guard recording belong to the first app.
 */
export function routerAppView(page: RouterPage, appId: string | null): RouterPage {
  const app = routerAppsOf(page).find((a) => a.id === appId);
  if (!app) return page;
  if (app.primary) return { ...page, appId: app.id };
  return {
    pageId: page.pageId,
    reportedAt: page.reportedAt,
    changedAt: page.changedAt,
    snapshot: app.snapshot ?? null,
    navigations: app.navigations ?? [],
    dropped: app.dropped,
    generation: app.generation,
    config: app.config,
    configTruncated: app.configTruncated,
    activeIds: app.activeIds,
    setup: app.setup,
    loops: app.loops,
    apps: page.apps,
    appId: app.id,
  };
}

export const routerCall = rpcTry;

export function isReplayableUrl(url: string): boolean {
  return (
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !/^\/*[a-z][a-z0-9+.-]*:/i.test(url) &&
    !url.includes('[redacted]') &&
    url.length <= 2000
  );
}

export const PAGE_UNREACHABLE = 'Could not reach the page.';

export async function routerAction(
  client: DevframeRpcClient | null,
  pageId: string | undefined,
  request: Record<string, unknown>,
  /** One app of a page that runs several (`RouterPage.appId`). */
  app?: string,
): Promise<Record<string, unknown>> {
  const result = await routerCall<Record<string, unknown>>(client, 'request-router-action', {
    pageId,
    ...(app ? { app } : {}),
    request,
  });
  return result ?? { error: PAGE_UNREACHABLE };
}

export const SHARED_STYLES = `
  .muted {
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.5;
  }
  .nil {
    color: var(--text-3);
  }
  code {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-height: 20px;
    margin: 2px 4px 2px 0;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 99px;
    background: var(--surface-2);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.4;
    vertical-align: middle;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: 99px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
    vertical-align: middle;
  }
  .badge[data-tone='good'] {
    border-color: color-mix(in srgb, var(--ok) 30%, transparent);
    background: color-mix(in srgb, var(--ok) 12%, transparent);
    color: var(--ok-text);
  }
  .badge[data-tone='warn'] {
    border-color: color-mix(in srgb, var(--warn) 30%, transparent);
    background: color-mix(in srgb, var(--warn) 12%, transparent);
    color: var(--warn-text);
  }
  .badge[data-tone='bad'] {
    border-color: color-mix(in srgb, var(--danger) 30%, transparent);
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger-text);
  }
  button.small {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--control-border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 0.15s var(--ease),
      border-color 0.15s var(--ease),
      transform 0.1s var(--ease);
  }
  button.small:hover:not(:disabled) {
    background: var(--surface-3);
    border-color: color-mix(in srgb, var(--text-3) 50%, var(--control-border));
  }
  button.small:active:not(:disabled) {
    transform: translateY(1px);
  }
  button.small:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  button.small.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  button.small.primary:hover:not(:disabled) {
    border-color: var(--accent-hover);
    background: var(--accent-hover);
  }
  button.small:focus-visible,
  .table-scroll:focus-visible,
  input[type='checkbox']:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  input.field,
  select {
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--control-border);
    border-radius: var(--radius-sm);
    background-color: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    transition:
      border-color 0.15s var(--ease),
      box-shadow 0.15s var(--ease);
  }
  input.field {
    text-overflow: ellipsis;
  }
  input.field::placeholder {
    color: var(--text-3);
  }
  input.field:hover:not(:focus),
  select:hover:not(:focus) {
    border-color: color-mix(in srgb, var(--text-3) 50%, var(--control-border));
  }
  input.field:focus-visible,
  select:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .note {
    margin: 0;
    padding: 10px 14px;
    border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--warn) 10%, transparent);
    color: var(--text);
    font-size: 13px;
    line-height: 1.5;
  }
  .empty {
    display: grid;
    gap: 6px;
    justify-items: center;
    margin: 0;
    padding: 40px 24px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    text-align: center;
    animation: enter 0.35s var(--ease) both;
  }
  .empty p {
    margin: 0;
    max-width: 480px;
    line-height: 1.6;
  }
  .empty-title {
    color: var(--text-strong);
    font-size: 14px;
    font-weight: 600;
  }
  .empty .small {
    margin-top: 8px;
  }
  .facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: baseline;
    gap: 8px 24px;
    margin: 0;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 13px;
  }
  .facts:empty {
    display: none;
  }
  dt {
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  dd {
    min-width: 0;
    margin: 0;
    color: var(--text);
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .table-scroll {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    animation: enter 0.35s var(--ease) both;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  th {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface-2) 60%, var(--surface));
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }
  td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    line-height: 1.5;
    vertical-align: top;
    transition: background-color 0.15s var(--ease);
  }
  tbody tr:last-child td {
    border-bottom: none;
  }
  tbody tr:hover td {
    background: var(--surface-2);
  }
  .path {
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 12.5px;
    white-space: nowrap;
  }
  h3 {
    margin: 8px 0 -4px;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  @media (max-width: 480px) {
    .facts {
      grid-template-columns: minmax(0, 1fr);
      gap: 2px;
    }
    .facts dd + dt {
      margin-top: 8px;
    }
  }
`;

export function tone(outcome: string): string {
  if (outcome === 'succeeded') return 'good';
  if (outcome === 'redirected' || outcome === 'pending' || outcome === 'skipped') return 'warn';
  if (outcome === 'cancelled' || outcome === 'failed') return 'bad';
  return '';
}
