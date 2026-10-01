import type { DevframeRpcClient } from 'devframe/client';
import { rpcTry } from '../rpc';

export interface ActiveRoute {
  path: string;
  url: string;
  outlet: string;
  component?: string;
  title?: string;
  ownTitle?: boolean;
  params: Record<string, unknown>;
  data: Record<string, unknown>;
  paramSources?: Record<string, string>;
  dataSources?: Record<string, string>;
  guards?: Record<string, string[]>;
  resolvers?: string[];
  lazy?: boolean;
  children: ActiveRoute[];
}

export interface GuardRun {
  guard: string;
  kind: string;
  route: string;
  result: string;
  ms: number;
}

export interface NavigationRecord {
  id: number;
  url: string;
  trigger: string;
  startedAt: number;
  endedAt?: number;
  outcome: string;
  finalUrl?: string;
  from?: string;
  extras?: string[];
  caller?: string;
  phases?: Record<string, number>;
  redirectedFrom?: number;
  redirectTo?: string;
  redirectKind?: string;
  guards?: { names: string[]; passed?: boolean; ms?: number };
  resolvers?: { names: string[]; ms?: number };
  checked?: { activate: string[]; deactivate: string[] };
  runs?: GuardRun[];
  lazyLoaded?: string[];
  reused?: string[];
  requests?: { count: number; urls: string[] };
  warnings?: string[];
  errorCode?: string;
  errorHandler?: string;
  scroll?: string;
  title?: string;
  reason?: string;
  code?: string;
  beforeConnect?: boolean;
  earlier?: number;
  probe?: boolean;
}

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

export interface RouteNode {
  id: string;
  path: string;
  fullPath: string;
  kind: string;
  component?: string;
  redirectTo?: string;
  pathMatch?: string;
  outlet?: string;
  lazy?: 'unloaded' | 'loaded';
  matcher?: string;
  guards?: Record<string, string[]>;
  resolvers?: string[];
  title?: string;
  providers?: number;
  children?: RouteNode[];
}

export interface SourceRoute {
  path: string;
  fullPath: string;
  kind: 'page' | 'group' | 'redirect' | 'wildcard';
  component?: string;
  redirectTo?: string;
  title?: string;
  guards?: Record<string, string[]>;
  resolvers?: string[];
  hasChildren: boolean;
  file: string;
  line?: number;
}

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

export interface OutletInfo {
  outlet: string;
  route?: string;
  component?: string;
  element?: string;
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
  exact?: boolean;
  ariaCurrent?: string;
}

export interface RouterSetup {
  mode: 'full' | 'events-only';
  setupKind: string;
  routers: number;
  angularVersion?: string;
  options: { name: string; value: string; set: boolean }[];
  features: Record<string, string>;
  strategies: Record<string, string>;
  baseHref?: string;
  hydrated?: number;
}

export interface RouterPage {
  pageId: string;
  reportedAt: number;
  changedAt?: number;
  snapshot: {
    url: string;
    queryParams: Record<string, unknown>;
    fragment: string | null;
    root: ActiveRoute;
    browserUrl?: string;
    urlDrift?: boolean;
    title?: string;
    pending?: { id: number; url: string };
  } | null;
  navigations: NavigationRecord[];
  dropped?: number;
  generation?: number;
  config?: RouteNode[];
  configTruncated?: number;
  activeIds?: string[];
  setup?: RouterSetup;
  outlets?: OutletInfo[];
  links?: LinkInfo[];
  preloads?: { path: string; startedAt: number; ms?: number; failed?: boolean }[];
  instrumented?: boolean;
  loops?: NavigationLoop[];
}

export interface LintFinding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  route: string;
  message: string;
  fix: string;
  angular: string;
}

export type LintResult =
  | { checked: true; findings: LintFinding[] }
  | { checked: false; reason: 'no-page' | 'events-only' | 'no-config' };

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
): Promise<Record<string, unknown>> {
  const result = await routerCall<Record<string, unknown>>(client, 'request-router-action', {
    pageId,
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
    color: var(--ok);
  }
  .badge[data-tone='warn'] {
    border-color: color-mix(in srgb, var(--warn) 30%, transparent);
    background: color-mix(in srgb, var(--warn) 12%, transparent);
    color: var(--warn);
  }
  .badge[data-tone='bad'] {
    border-color: color-mix(in srgb, var(--danger) 30%, transparent);
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }
  button.small {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--border-strong);
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
    border-color: color-mix(in srgb, var(--text-3) 50%, var(--border-strong));
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
    border: 1px solid var(--border-strong);
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
    border-color: color-mix(in srgb, var(--text-3) 50%, var(--border-strong));
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
