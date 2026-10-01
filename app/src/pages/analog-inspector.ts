import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { time } from '../format';
import { rpcCall, rpcTry as call } from '../rpc';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';
import { Select } from '../ui/select';

interface AnalogRoute {
  id: string;
  fullPath: string;
  file?: string;
  kind: 'page' | 'layout' | 'markdown' | 'group' | 'implicit';
  params: string[];
  catchAll?: 'required' | 'optional';
  serverFile?: string;
  serverExports?: string[];
  routeMeta?: string[];
  title?: string;
  children: AnalogRoute[];
}

interface ApiRoute {
  path: string;
  method: string;
  file: string;
}

interface ContentFile {
  file: string;
  slug: string;
  attributes: Record<string, string>;
  error?: string;
}

interface ServerFn {
  name: string;
  file: string;
  id: string;
  method: string;
}

interface AnalogProject {
  analog: boolean;
  version?: string;
  routes: AnalogRoute[];
  api: ApiRoute[];
  middleware: string[];
  content: ContentFile[];
  serverFns?: ServerFn[];
}

type ActionOutcome = 'success' | 'redirect' | 'invalid' | 'error';

interface AnalogCall {
  id: number;
  at: number;
  kind: 'page' | 'load' | 'action' | 'fn' | 'api';
  method: string;
  url: string;
  route?: string;
  status: number;
  ms: number;
  bytes?: number;
  from: string;
  render?: 'ssr' | 'client';
  outcome?: ActionOutcome;
  location?: string;
  seeded?: boolean;
  preview?: string;
}

interface AnalogPage {
  pageId: string;
  url: string;
  chain: { path: string; file?: string; serverFile?: string }[];
  load?: { preview: string; bytes: number; keys: string[] };
  serverContext?: string;
  hydrated: number;
  hydrationErrors: string[];
}

interface DuplicateLoad {
  route: string;
  ssrAt: number;
  browserAt: number;
}

interface ServerFnRefetch {
  id: string;
  ssrAt: number;
  browserAt: number;
}

interface AnalogState {
  pages?: AnalogPage[];
  calls?: AnalogCall[];
  duplicates?: DuplicateLoad[];
  refetches?: ServerFnRefetch[];
}

interface Finding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  file?: string;
  path?: string;
  message: string;
  fix: string;
}

interface UrlMatch {
  matched: boolean;
  chain: AnalogRoute[];
  params: Record<string, string>;
  rejected: { file?: string; path: string; reason: string }[];
}

interface RenderRow {
  path: string;
  file?: string;
  mode: 'ssr' | 'ssg' | 'client' | 'cached' | 'redirect';
  reason: string;
  last?: { render?: 'ssr' | 'client'; status: number; ms: number; at: number };
}

interface PrerenderPlan {
  dynamicConfig: boolean;
  listed: string[] | null;
  fromRules?: string[];
  staticMissing: string[];
  dynamic: string[];
  built: string[];
  notBuilt: string[];
}

interface ApiResult {
  ok?: boolean;
  status?: number;
  ms?: number;
  type?: string;
  body?: string;
  error?: string;
}

type View = 'routes' | 'server' | 'render' | 'content' | 'lint';

interface LintCard {
  rule: string;
  severity: Finding['severity'];
  title: string;
  summary: string;
  fix: string;
  items: { file?: string; path?: string; message?: string }[];
}

const LINT_TEXT: Record<string, { title: string; summary: string }> = {
  'scan-error': {
    title: 'A folder could not be read',
    summary: 'Its files are missing from routes, API routes and lint results.',
  },
  'duplicate-url': {
    title: 'Two files serve the same URL',
    summary: 'Only one of them is reachable; the other never renders.',
  },
  'sibling-params': {
    title: 'Two dynamic pages in one folder',
    summary: 'Both are [param] pages at the same level, so the first one always wins.',
  },
  'missing-default-export': {
    title: 'Page has no default export',
    summary: 'Analog needs the component as the default export, so the page renders nothing.',
  },
  'redirect-with-component': {
    title: 'Redirect page also exports a component',
    summary: 'The redirect runs first, so the component never shows.',
  },
  'redirect-path-match': {
    title: 'Redirect matches too much',
    summary: 'An empty-path redirect without pathMatch "full" catches every URL below it.',
  },
  'layout-without-outlet': {
    title: 'Layout has no router-outlet',
    summary: 'The layout has child pages, but without <router-outlet> they never render.',
  },
  'server-without-load': {
    title: '.server.ts without load or action',
    summary: 'The server file exports no load, action or server function, so Analog calls nothing.',
  },
  'orphan-server-file': {
    title: '.server.ts without a page',
    summary: 'No page file sits next to it, so its load never runs.',
  },
  'api-method-suffix': {
    title: 'Unknown method suffix on an API file',
    summary: 'The suffix is not an HTTP method, so it becomes part of the URL.',
  },
  'duplicate-api-route': {
    title: 'Two handlers for one API route',
    summary: 'Two files answer the same method and path.',
  },
  'api-outside-prefix': {
    title: 'Server route outside the API prefix',
    summary: 'During vite dev only routes under the prefix reach Nitro.',
  },
  'prerender-unknown-route': {
    title: 'Prerender entry matches no page',
    summary: 'prerender.routes lists a path that no page file serves.',
  },
  'prerender-missing-root': {
    title: 'Home page is not prerendered',
    summary: 'static is on, but prerender.routes leaves out /.',
  },
  'content-frontmatter': {
    title: 'Broken frontmatter',
    summary: 'The markdown frontmatter cannot be read.',
  },
  'duplicate-slug': {
    title: 'Two posts share a slug',
    summary: 'injectContent picks one of them at random.',
  },
  'content-shadows-page': {
    title: 'Markdown file takes over a page',
    summary:
      'Files under src/content are routes too, so these URLs render the markdown file instead of the [param] page.',
  },
  'load-fetched-twice': {
    title: 'load() runs twice',
    summary:
      'These pages fetched their data while rendering on the server and again in the browser.',
  },
  'fn-fetched-twice': {
    title: 'Server function read runs twice',
    summary:
      'These reads ran while rendering on the server and again in the browser right after hydration.',
  },
  'restart-needed': {
    title: 'New pages need a restart',
    summary: 'These page files exist, but the running router does not know them yet.',
  },
  'hydration-error': {
    title: 'Hydration error',
    summary: 'The browser DOM did not match the server HTML.',
  },
  'api-not-found': {
    title: 'API call failed with 404 or 405',
    summary: 'A request hit a path or method that no server route handles.',
  },
};
type Kind = 'all' | AnalogCall['kind'];

const STATIC_MESSAGES = new Set([
  'missing-default-export',
  'redirect-with-component',
  'redirect-path-match',
  'layout-without-outlet',
  'server-without-load',
  'orphan-server-file',
  'load-fetched-twice',
  'restart-needed',
  'prerender-missing-root',
]);

const MODE_LABEL = {
  ssr: 'SSR',
  ssg: 'Prerendered',
  client: 'Client only',
  cached: 'Cached',
  redirect: 'Redirect',
} as const;
const KIND_LABEL: Record<Kind, string> = {
  all: 'All',
  page: 'Pages',
  load: 'load()',
  action: 'Actions',
  fn: 'Server fn',
  api: 'API',
};
const OUTCOME_LABEL: Record<ActionOutcome, string> = {
  success: 'succeeded',
  redirect: 'redirected',
  invalid: 'validation errors',
  error: 'failed',
};
const OUTCOME_TONE: Record<ActionOutcome, string> = {
  success: 'good',
  redirect: 'info',
  invalid: 'warn',
  error: 'bad',
};

function walk(routes: AnalogRoute[], depth = 0, out: { route: AnalogRoute; depth: number }[] = []) {
  for (const route of routes) {
    out.push({ route, depth });
    walk(route.children, depth + 1, out);
  }
  return out;
}

@Component({
  selector: 'app-analog-inspector',
  imports: [Select],
  template: `
    @if (project() === null) {
      <div class="loading" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <span>Reading the project…</span>
      </div>
    } @else if (!project()!.analog) {
      <div class="empty">
        <h2 class="empty-title">This app is not an Analog app.</h2>
        <p class="muted">
          Add <code>ngDevtools()</code> from <code>@santoshyadavdev/ng-devtools/vite</code> next to
          <code>analog()</code> in vite.config.ts and run the Analog dev server.
        </p>
      </div>
    } @else {
      <section class="summary" aria-label="Analog summary">
        <div class="stat">
          <span class="label">Analog</span>
          <span class="value">{{ project()!.version || 'unknown' }}</span>
        </div>
        <div class="stat">
          <span class="label">Pages</span>
          <span class="value">{{ pageCount() }}</span>
        </div>
        <div class="stat">
          <span class="label">API routes</span>
          <span class="value">{{ project()!.api.length }}</span>
        </div>
        <div class="stat">
          <span class="label">Server calls</span>
          <span class="value">{{ allCalls().length }}</span>
        </div>
        <div class="stat" [attr.data-tone]="findings().length ? 'warn' : 'good'">
          <span class="label">Issues</span>
          <span class="value">{{ findings().length }}</span>
        </div>
        @if (page(); as p) {
          <div class="stat wide">
            <span class="label">Open in the browser</span>
            <span class="value mono" [title]="p.url">{{ p.url }}</span>
          </div>
        }
      </section>

      <div class="tabs" role="tablist" aria-label="Analog views" (keydown)="onKey($event)">
        @for (v of views(); track v.id) {
          <button
            type="button"
            role="tab"
            [id]="'analog-tab-' + v.id"
            [attr.aria-selected]="v.id === view()"
            [attr.aria-controls]="'analog-panel-' + v.id"
            [attr.tabindex]="v.id === view() ? 0 : -1"
            (click)="view.set(v.id)"
          >
            {{ v.label }}
            <span class="count" [attr.data-tone]="v.tone">{{ v.count }}</span>
          </button>
        }
      </div>

      <div
        class="panel"
        role="tabpanel"
        [id]="'analog-panel-' + view()"
        [attr.aria-labelledby]="'analog-tab-' + view()"
      >
        @switch (view()) {
          @case ('routes') {
            <div class="toolbar">
              <form class="inline explain" (submit)="$event.preventDefault(); explain()">
                <label for="analog-url">Test a URL</label>
                <input
                  id="analog-url"
                  class="field grow mono"
                  type="text"
                  placeholder="/products/42"
                  [value]="testUrl()"
                  (input)="testUrl.set($any($event.target).value)"
                />
                <button type="submit" class="btn primary" [disabled]="explaining()">
                  {{ explaining() ? 'Explaining…' : 'Explain' }}
                </button>
              </form>
              <label class="sr-only" for="route-filter">Filter routes</label>
              <input
                id="route-filter"
                class="field filter"
                type="search"
                placeholder="Filter by path or file"
                [value]="filter()"
                (input)="filter.set($any($event.target).value)"
              />
            </div>
            <div class="explain-result" role="status">
              @if (explainError(); as error) {
                <div class="callout" data-tone="bad">{{ error }}</div>
              } @else if (explained(); as e) {
                <div class="callout" [attr.data-tone]="e.match.matched ? 'good' : 'bad'">
                  @if (e.match.matched) {
                    <strong class="mono">{{ e.url }}</strong> renders
                    <ol class="chain">
                      @for (r of e.match.chain; track r.id) {
                        <li>
                          <span class="mono">{{ short(r.file) ?? r.fullPath }}</span>
                          <span class="pill" [attr.data-kind]="r.kind">{{ r.kind }}</span>
                        </li>
                      }
                    </ol>
                    @if (paramList(e.match.params).length) {
                      <div class="chips">
                        @for (p of paramList(e.match.params); track p[0]) {
                          <span class="chip mono">{{ p[0] }} = {{ p[1] }}</span>
                        }
                      </div>
                    }
                  } @else {
                    <strong class="mono">{{ e.url }}</strong> matches no file route. Angular throws
                    NG04002 "Cannot match any routes".
                    @if (e.match.rejected.length) {
                      <ul class="plain">
                        @for (r of e.match.rejected.slice(0, 5); track $index) {
                          <li>
                            <span class="mono">{{ short(r.file) ?? r.path }}</span>
                            <span class="muted">{{ r.reason }}</span>
                          </li>
                        }
                      </ul>
                    }
                  }
                </div>
              }
            </div>
            <div class="table-wrap" role="region" aria-label="File routes" tabindex="0">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Route</th>
                    <th scope="col">File</th>
                    <th scope="col">Data</th>
                    <th scope="col">Route meta</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of routeRows(); track row.route.id) {
                    <tr
                      [class.open]="isOpen(row.route)"
                      [class.dim]="row.route.kind === 'group' || row.route.kind === 'implicit'"
                    >
                      <td>
                        <div class="route" [style.padding-left.px]="row.depth * 16">
                          @if (row.depth) {
                            <span class="guide" aria-hidden="true">└</span>
                          }
                          <span class="mono path">{{ row.route.fullPath }}</span>
                          <span class="pill" [attr.data-kind]="row.route.kind">{{
                            kindText(row.route)
                          }}</span>
                          @if (isOpen(row.route)) {
                            <span class="pill live">open</span>
                          }
                        </div>
                      </td>
                      <td>
                        @if (row.route.file) {
                          <span class="file"
                            ><span class="dir">{{ dir(row.route.file) }}</span
                            >{{ base(row.route.file) }}</span
                          >
                        } @else {
                          <span class="muted">folder only</span>
                        }
                      </td>
                      <td>
                        <div class="meta">
                          @for (e of serverExports(row.route); track e) {
                            <span class="pill" data-kind="load">{{ e }}()</span>
                          }
                        </div>
                      </td>
                      <td>
                        @if (row.route.title) {
                          <span class="chip">"{{ row.route.title }}"</span>
                        }
                        @for (key of row.route.routeMeta ?? []; track key) {
                          @if (key !== 'title') {
                            <span class="chip mono">{{ key }}</span>
                          }
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="empty-row">
                        @if (filter().trim()) {
                          No route matches the filter. Try part of a path or a file name.
                        } @else {
                          No file routes yet. Add a .page.ts file under src/app/pages.
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @case ('server') {
            @if (duplicates().length) {
              <div class="callout" data-tone="warn" role="note">
                <strong>load() ran twice</strong> for
                @for (d of duplicates(); track d; let last = $last) {
                  <span class="mono">{{ d }}</span
                  >{{ last ? '' : ', ' }}
                }
                : once while server rendering, again in the browser. TransferState did not serve the
                server result.
              </div>
            }
            @if (refetchedFns().length) {
              <div class="callout" data-tone="warn" role="note">
                <strong>Server function read ran twice</strong>:
                @for (name of refetchedFns(); track name; let last = $last) {
                  <span class="mono">{{ name }}</span
                  >{{ last ? '' : ', ' }}
                }
                ran while server rendering, then again in the browser. The browser did not use the
                TransferState seed.
              </div>
            }
            <div class="calls-bar">
              <fieldset class="segmented">
                <legend class="sr-only">Show calls of kind</legend>
                @for (k of kinds; track k) {
                  <label [class.on]="kind() === k">
                    <input
                      type="radio"
                      name="analog-kind"
                      class="sr-only"
                      [checked]="kind() === k"
                      (change)="kind.set(k)"
                    />
                    {{ kindLabel(k) }} <span class="muted">{{ kindCount(k) }}</span>
                  </label>
                }
              </fieldset>
              <button
                type="button"
                class="btn ghost"
                [disabled]="!allCalls().length"
                (click)="clearCalls()"
              >
                Clear calls
              </button>
            </div>
            @if (calls().length) {
              <div class="table-wrap" role="region" aria-label="Server calls" tabindex="0">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">At</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Request</th>
                      <th scope="col">Status</th>
                      <th scope="col" class="num">Duration</th>
                      <th scope="col">From</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of calls(); track c.id) {
                      <tr>
                        <td class="muted nowrap">{{ time(c.at) }}</td>
                        <td>
                          <span class="pill" [attr.data-call]="c.kind">{{
                            kindLabel(c.kind)
                          }}</span>
                        </td>
                        <td class="request">
                          <div class="meta">
                            <span class="method" [attr.data-method]="c.method">{{ c.method }}</span>
                            @if (fnOf(c); as fn) {
                              <strong class="mono url">{{ fn.name }}</strong>
                              <span class="mono muted">{{ short(fn.file) }}</span>
                            } @else {
                              <span class="mono url">{{ c.url }}</span>
                            }
                            @if (c.seeded) {
                              <span class="pill">ran during server rendering</span>
                            }
                            @if (c.outcome) {
                              <span class="pill" [attr.data-tone]="outcomeTone(c.outcome)"
                                >{{ outcomeLabel(c.outcome) }}
                                @if (c.location) {
                                  to {{ c.location }}
                                }
                              </span>
                            }
                            @if (c.render) {
                              <span
                                class="pill"
                                [attr.data-mode]="c.render === 'ssr' ? 'ssr' : 'client'"
                                >{{ c.render === 'ssr' ? 'server rendered' : 'client only' }}</span
                              >
                            }
                          </div>
                          @if (c.preview) {
                            <details>
                              <summary>Response</summary>
                              <pre class="code">{{ pretty(c.preview) }}</pre>
                            </details>
                          }
                        </td>
                        <td>
                          <span class="status" [attr.data-status]="statusClass(c.status)">{{
                            c.status
                          }}</span>
                        </td>
                        <td class="num nowrap">
                          @if (c.seeded) {
                            <span class="muted">in process</span>
                          } @else {
                            {{ c.ms }} ms
                          }
                        </td>
                        <td class="muted">{{ c.from }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="empty-box">
                <p class="empty-lead">
                  @if (allCalls().length) {
                    No calls of this kind yet.
                  } @else {
                    No calls yet.
                  }
                </p>
                <p class="muted">
                  Navigate in the app to see page renders, load() fetches, form actions, server
                  functions and API calls.
                </p>
              </div>
            }

            <h2>API routes</h2>
            <div class="table-wrap" role="region" aria-label="API routes" tabindex="0">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Method</th>
                    <th scope="col">Path</th>
                    <th scope="col">File</th>
                    <th scope="col"><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (api of project()!.api; track api.file + api.method) {
                    <tr>
                      <td>
                        <span class="method" [attr.data-method]="api.method">{{ api.method }}</span>
                      </td>
                      <td class="mono">{{ api.path }}</td>
                      <td>
                        <span class="file"
                          ><span class="dir">{{ dir(api.file) }}</span
                          >{{ base(api.file) }}</span
                        >
                      </td>
                      <td class="actions">
                        <button
                          type="button"
                          class="btn ghost"
                          [attr.aria-label]="'Try ' + api.method + ' ' + api.path"
                          (click)="tryApi(api)"
                        >
                          Try
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="empty-row">
                        No API routes. Add a handler under src/server/routes to test it here.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (serverFns().length) {
              <h2>Server functions</h2>
              <div class="table-wrap" role="region" aria-label="Server functions" tabindex="0">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Method</th>
                      <th scope="col">Name</th>
                      <th scope="col">File</th>
                      <th scope="col" class="num">Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (fn of serverFns(); track fn.id) {
                      <tr>
                        <td>
                          <span class="method" [attr.data-method]="fn.method">{{ fn.method }}</span>
                        </td>
                        <td class="mono">{{ fn.name }}</td>
                        <td>
                          <span class="file"
                            ><span class="dir">{{ dir(fn.file) }}</span
                            >{{ base(fn.file) }}</span
                          >
                        </td>
                        <td class="num tnum">{{ fnCalls(fn.id) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <form class="card playground" (submit)="$event.preventDefault(); send()">
              <h2>Request playground</h2>
              <div class="row">
                <app-select
                  class="method-select"
                  ariaLabel="Method"
                  [options]="methodOptions"
                  [value]="method()"
                  (valueChange)="method.set($event ?? 'GET')"
                />
                <label for="api-path" class="sr-only">Path</label>
                <input
                  id="api-path"
                  class="field grow mono"
                  type="text"
                  placeholder="/api/v1/products"
                  [value]="apiPath()"
                  (input)="apiPath.set($any($event.target).value)"
                />
                <button
                  type="submit"
                  class="btn primary"
                  [disabled]="!canSend()"
                  [attr.aria-describedby]="sendHintId()"
                >
                  {{ sending() ? 'Sending…' : 'Send' }}
                </button>
              </div>
              @if (!canCall()) {
                <p id="analog-calls-off" class="muted">{{ callsOff }}</p>
              } @else if (needsConfirm()) {
                <p id="analog-confirm-hint" class="muted">
                  Tick "This request can change data on the dev server" below to send a
                  {{ method() }} request.
                </p>
              }
              @if (method() !== 'GET') {
                <label for="api-body">JSON body</label>
                <textarea
                  id="api-body"
                  class="field mono"
                  rows="3"
                  placeholder='{"name": "Ada"}'
                  [value]="apiBody()"
                  (input)="apiBody.set($any($event.target).value)"
                ></textarea>
                <label class="check"
                  ><input
                    type="checkbox"
                    [checked]="confirmSend()"
                    (change)="confirmSend.set(!confirmSend())"
                  />
                  This request can change data on the dev server</label
                >
              }
              @if (sending()) {
                <p class="muted" role="status">Sending {{ method() }} {{ apiPath().trim() }}…</p>
              } @else if (response(); as r) {
                <div class="response" role="status">
                  @if (r.error) {
                    <div class="row">
                      <span class="status" data-status="bad">Refused</span>
                      <span>{{ r.error }}</span>
                    </div>
                  } @else {
                    <div class="row">
                      <span class="status" [attr.data-status]="statusClass(r.status ?? 0)">{{
                        r.status
                      }}</span>
                      <span class="muted">{{ r.ms }} ms · {{ r.type || 'no content type' }}</span>
                    </div>
                    <pre class="code">{{ pretty(r.body ?? '') }}</pre>
                  }
                </div>
              }
            </form>
          }

          @case ('render') {
            @if (modeCounts().length) {
              <div class="chips">
                @for (m of modeCounts(); track m.mode) {
                  <span class="pill" [attr.data-mode]="m.mode">{{ m.label }} · {{ m.count }}</span>
                }
              </div>
            }
            <div class="table-wrap" role="region" aria-label="Render modes" tabindex="0">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Route</th>
                    <th scope="col">Configured</th>
                    <th scope="col">Last request</th>
                    <th scope="col">File</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of renderRows(); track row.path) {
                    <tr>
                      <td class="mono path">{{ row.path }}</td>
                      <td>
                        <div class="meta">
                          <span class="pill" [attr.data-mode]="row.mode">{{
                            modeLabel(row.mode)
                          }}</span>
                          <span class="muted small">{{ row.reason }}</span>
                        </div>
                      </td>
                      <td>
                        @if (row.last; as last) {
                          <div class="meta">
                            <span class="status" [attr.data-status]="statusClass(last.status)">{{
                              last.status
                            }}</span>
                            <span class="muted small tnum"
                              >{{ last.render === 'client' ? 'client only' : 'server rendered' }} ·
                              {{ last.ms }} ms</span
                            >
                            @if (mismatch(row)) {
                              <span class="pill" data-tone="warn">differs from config</span>
                            }
                          </div>
                        } @else {
                          <span class="muted small">not requested yet</span>
                        }
                      </td>
                      <td>
                        @if (row.file) {
                          <span class="file"
                            ><span class="dir">{{ dir(row.file) }}</span
                            >{{ base(row.file) }}</span
                          >
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="empty-row">
                        No page routes to render yet. Add a .page.ts file under src/app/pages.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (plan(); as p) {
              <div class="card">
                <h2>Prerender plan</h2>
                @if (p.dynamicConfig) {
                  <p class="muted">
                    prerender.routes is a function, so the list is known only at build time.
                  </p>
                } @else {
                  <dl class="facts">
                    <dt>Listed</dt>
                    <dd>
                      @for (r of p.listed ?? ['/']; track r) {
                        <span class="chip mono">{{ r }}</span>
                      }
                      @if (!p.listed) {
                        <span class="muted small">default, nothing configured</span>
                      }
                    </dd>
                    @if (p.fromRules?.length) {
                      <dt>From routeRules</dt>
                      <dd>
                        @for (r of p.fromRules; track r) {
                          <span class="chip mono">{{ r }}</span>
                        }
                      </dd>
                    }
                    @if (p.staticMissing.length) {
                      <dt>Static, not listed</dt>
                      <dd>
                        @for (r of p.staticMissing; track r) {
                          <span class="chip mono" data-tone="warn">{{ r }}</span>
                        }
                      </dd>
                    }
                    @if (p.dynamic.length) {
                      <dt>Need explicit entries</dt>
                      <dd>
                        @for (r of p.dynamic; track r) {
                          <span class="chip mono">{{ r }}</span>
                        }
                      </dd>
                    }
                    <dt>Build output</dt>
                    <dd class="tnum">
                      @if (p.built.length) {
                        {{ p.built.length }} page(s) in dist/analog/public
                        @if (p.notBuilt.length) {
                          · missing
                          @for (r of p.notBuilt; track r) {
                            <span class="chip mono" data-tone="bad">{{ r }}</span>
                          }
                        }
                      } @else {
                        <span class="muted small">no build yet</span>
                      }
                    </dd>
                  </dl>
                }
              </div>
            }
          }

          @case ('content') {
            @if (project()!.content.length) {
              <div class="table-wrap" role="region" aria-label="Content files" tabindex="0">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">URL</th>
                      <th scope="col">Slug</th>
                      <th scope="col">Date</th>
                      <th scope="col">File</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (f of project()!.content; track f.file) {
                      <tr>
                        <td>
                          <strong>{{ f.attributes['title'] || '(no title)' }}</strong>
                          @if (f.error) {
                            <div>
                              <span class="pill" data-tone="bad">{{ f.error }}</span>
                            </div>
                          }
                          @if (shadowed(f.file); as page) {
                            <div>
                              <span class="pill" data-tone="warn">takes over {{ base(page) }}</span>
                            </div>
                          }
                        </td>
                        <td class="mono path">{{ contentUrl(f.file) ?? '' }}</td>
                        <td class="mono">{{ f.slug }}</td>
                        <td class="muted nowrap tnum">{{ f.attributes['date'] || '' }}</td>
                        <td>
                          <span class="file"
                            ><span class="dir">{{ dir(f.file) }}</span
                            >{{ base(f.file) }}</span
                          >
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="empty-box">
                <p class="empty-lead">No markdown files under src/content.</p>
                <p class="muted">
                  Add a .md file there to see its title, slug, date and the URL it serves.
                </p>
              </div>
            }
          }

          @case ('lint') {
            @if (findings().length) {
              <p class="muted">
                {{ findings().length }} issue(s) in {{ lintCards().length }} group(s). Each card
                says what is wrong, where, and how to fix it.
              </p>
              <ul class="findings">
                @for (card of lintCards(); track card.rule) {
                  <li [attr.data-tone]="tone(card.severity)">
                    <div class="finding-head">
                      <span class="pill" [attr.data-tone]="tone(card.severity)">{{
                        card.severity
                      }}</span>
                      <strong class="finding-title">{{ card.title }}</strong>
                      @if (card.items.length > 1) {
                        <span class="count">{{ card.items.length }}</span>
                      }
                    </div>
                    <p>{{ card.summary }}</p>
                    <ul class="where">
                      @for (item of card.items; track $index) {
                        <li>
                          @if (item.file) {
                            <span class="file"
                              ><span class="dir">{{ dir(item.file) }}</span
                              >{{ base(item.file) }}</span
                            >
                          }
                          @if (item.path && item.path !== item.file) {
                            <span class="mono path">{{ item.path }}</span>
                          }
                          @if (item.message) {
                            <p class="detail">{{ item.message }}</p>
                          }
                        </li>
                      }
                    </ul>
                    <div class="fix"><strong>How to fix</strong> {{ card.fix }}</div>
                    <span class="rule mono">{{ card.rule }}</span>
                  </li>
                }
              </ul>
            } @else {
              <div class="callout" data-tone="good" role="status">
                <strong>No Analog problems found.</strong> Routes, server files, prerender config
                and content all check out.
              </div>
            }
          }
        }
      </div>
    }
  `,
  styles: `
    :host {
      --good: var(--ok);
      --bad: var(--danger);
      --info: #60a5fa;
      --mono: var(--font-mono);
      display: grid;
      gap: 16px;
      min-width: 0;
      color: var(--text);
      font-size: 13px;
    }
    .loading {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text-2);
    }
    .spinner {
      width: 16px;
      height: 16px;
      flex: none;
      border: 2px solid var(--border-strong);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation: none;
        border-color: var(--accent-line);
      }
    }
    .tnum {
      font-variant-numeric: tabular-nums;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      min-width: 0;
    }
    .empty-row {
      padding: 24px 16px;
      color: var(--text-2);
      text-align: center;
    }
    tbody tr:hover td.empty-row {
      background: transparent;
    }
    .empty-box {
      display: grid;
      gap: 4px;
      padding: 24px 16px;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius);
      text-align: center;
    }
    .empty-box p {
      margin: 0;
      line-height: 1.55;
    }
    .empty-lead {
      color: var(--text-strong);
      font-weight: 600;
    }
    .mono {
      font-family: var(--mono);
      font-size: 12.5px;
    }
    .muted {
      color: var(--text-2);
    }
    .small {
      font-size: 12px;
    }
    .nowrap {
      white-space: nowrap;
    }
    code {
      padding: 1px 6px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface-2);
      color: var(--text-strong);
      font-family: var(--mono);
      font-size: 12.5px;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      animation: enter 0.35s var(--ease) both;
    }
    .stat {
      display: grid;
      gap: 6px;
      align-content: start;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
      transition:
        border-color 180ms var(--ease),
        background-color 180ms var(--ease);
    }
    .stat:hover {
      border-color: var(--border-strong);
    }
    .stat.wide {
      grid-column: span 2;
      min-width: 0;
    }
    @media (max-width: 340px) {
      .stat.wide {
        grid-column: 1 / -1;
      }
    }
    .stat .label {
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .stat .value {
      color: var(--text-strong);
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    .stat .value.mono {
      overflow: hidden;
      color: var(--text);
      font-size: 13px;
      font-weight: 500;
      line-height: 24px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stat[data-tone='warn'] .value {
      color: var(--warn);
    }
    .stat[data-tone='good'] .value {
      color: var(--ok);
    }

    .tabs {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 2px;
      justify-self: start;
      max-width: 100%;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
    }
    [role='tab'] {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      min-height: 28px;
      padding: 4px 12px;
      border: none;
      border-radius: 7px;
      background: transparent;
      color: var(--text-2);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 180ms var(--ease),
        color 180ms var(--ease),
        box-shadow 180ms var(--ease);
    }
    [role='tab']:hover {
      color: var(--text);
    }
    [role='tab'][aria-selected='true'] {
      background: var(--surface-3);
      color: var(--text-strong);
      box-shadow: inset 0 0 0 1px var(--border-strong);
    }
    .count {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    [role='tab'][aria-selected='true'] .count {
      background: var(--border-strong);
      color: var(--text);
    }
    .count[data-tone='warn'],
    [role='tab'][aria-selected='true'] .count[data-tone='warn'] {
      background: color-mix(in srgb, var(--warn) 12%, transparent);
      color: var(--warn);
    }

    .panel {
      display: grid;
      gap: 16px;
      min-width: 0;
      animation: enter 0.35s var(--ease) both;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
    }
    .explain {
      flex: 1 1 320px;
      min-width: 0;
    }
    .filter {
      flex: 0 1 240px;
      min-width: 0;
    }
    @media (max-width: 560px) {
      .filter {
        flex: 1 1 100%;
      }
    }
    .inline,
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .inline > label,
    .playground > label:not(.check) {
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .field {
      box-sizing: border-box;
      height: 34px;
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background-color: var(--bg);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      transition:
        border-color 180ms var(--ease),
        box-shadow 180ms var(--ease);
    }
    .field.mono {
      font-family: var(--mono);
      font-size: 13px;
    }
    .field::placeholder {
      color: var(--text-3);
    }
    .field:focus,
    .field:focus-visible {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
      outline: none;
    }
    .method-select {
      width: 112px;
      font-family: var(--mono);
    }
    textarea.field {
      height: auto;
      padding: 8px 12px;
    }
    .grow {
      flex: 1 1 180px;
      min-width: 0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      height: 34px;
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 160ms var(--ease),
        border-color 160ms var(--ease),
        color 160ms var(--ease);
    }
    .btn:hover {
      background: var(--surface-3);
      border-color: var(--border-strong);
    }
    .btn:active {
      transform: translateY(1px);
    }
    .btn.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
    }
    .btn.primary:hover {
      border-color: var(--accent-hover);
      background: var(--accent-hover);
    }
    .btn.ghost {
      height: 28px;
      padding: 0 12px;
      font-size: 12px;
    }
    .btn.ghost:hover {
      border-color: var(--accent-line);
      color: var(--text-strong);
    }
    td.actions {
      width: 1%;
      text-align: right;
      vertical-align: middle;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    [role='tab']:focus-visible,
    .btn:focus-visible,
    .table-wrap:focus-visible,
    summary:focus-visible,
    .segmented label:focus-within {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .callout {
      padding: 12px 16px;
      border: 1px solid color-mix(in srgb, var(--info) 30%, transparent);
      border-radius: var(--radius);
      background: color-mix(in srgb, var(--info) 8%, var(--surface));
      line-height: 1.6;
      animation: enter 0.35s var(--ease) both;
    }
    .callout[data-tone='good'] {
      border-color: color-mix(in srgb, var(--ok) 30%, transparent);
      background: color-mix(in srgb, var(--ok) 12%, transparent);
    }
    .callout[data-tone='warn'] {
      border-color: color-mix(in srgb, var(--warn) 30%, transparent);
      background: color-mix(in srgb, var(--warn) 12%, transparent);
    }
    .callout[data-tone='bad'] {
      border-color: color-mix(in srgb, var(--danger) 30%, transparent);
      background: color-mix(in srgb, var(--danger) 12%, transparent);
    }
    .callout strong {
      color: var(--text-strong);
    }
    .callout strong.mono {
      overflow-wrap: anywhere;
    }
    .chain {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
    }
    .chain li {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .chain li:not(:last-child)::after {
      content: '›';
      margin-left: 2px;
      color: var(--text-3);
    }
    .callout .chips {
      margin-top: 8px;
    }
    .plain {
      margin: 8px 0 0;
      padding-left: 18px;
    }
    .plain li {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
      animation: enter 0.35s var(--ease) both;
    }
    table {
      width: 100%;
      min-width: 560px;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    th {
      position: sticky;
      top: 0;
      background: var(--surface);
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    td.nowrap {
      font-variant-numeric: tabular-nums;
    }
    tbody td {
      transition: background-color 160ms var(--ease);
    }
    tbody tr:hover td {
      background: var(--surface-2);
    }
    tr.open td {
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    tr.open:hover td {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
    }
    tr.open td:first-child {
      box-shadow: inset 2px 0 0 var(--accent);
    }
    tr.dim .path {
      color: var(--text-2);
    }
    .route {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .guide {
      color: var(--text-3);
      font-family: var(--mono);
    }
    .path {
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .file {
      font-family: var(--mono);
      font-size: 12.5px;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .dir {
      color: var(--text-3);
    }

    .pill,
    .chip,
    .status,
    .method {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 500;
      line-height: 18px;
      white-space: nowrap;
    }
    .pill {
      border: 1px solid var(--border-strong);
      background: var(--surface-2);
      color: var(--text-2);
    }
    .chip {
      margin: 0 4px 4px 0;
      padding: 3px 10px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      font-size: 12px;
      line-height: 16px;
    }
    .chip.mono {
      font-size: 12px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chips .pill {
      padding: 3px 10px;
      font-size: 12px;
    }
    .pill.live {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--accent);
    }
    .pill[data-kind='layout'] {
      border-color: #94a3b8;
      color: #e2e8f0;
    }
    .pill[data-kind='markdown'] {
      border-color: #0ea5e9;
      color: #bae6fd;
    }
    .pill[data-kind='load'] {
      border-color: #2dd4bf;
      color: #99f6e4;
    }
    .pill[data-mode='ssr'] {
      border-color: #3b82f6;
      color: #bfdbfe;
    }
    .pill[data-mode='ssg'] {
      border-color: #22c55e;
      color: #bbf7d0;
    }
    .pill[data-mode='client'] {
      border-color: #eab308;
      color: #fef08a;
    }
    .pill[data-mode='cached'] {
      border-color: #a855f7;
      color: #e9d5ff;
    }
    .pill[data-mode='redirect'] {
      border-color: #94a3b8;
      color: #e2e8f0;
    }
    .pill[data-call='page'] {
      border-color: #3b82f6;
      color: #bfdbfe;
    }
    .pill[data-call='load'] {
      border-color: #2dd4bf;
      color: #99f6e4;
    }
    .pill[data-call='fn'] {
      border-color: #14b8a6;
      color: #99f6e4;
    }
    .pill[data-call='api'] {
      border-color: #f97316;
      color: #fed7aa;
    }
    .pill[data-call='action'] {
      border-color: #ec4899;
      color: #fbcfe8;
    }
    [data-tone='good'].pill {
      border-color: color-mix(in srgb, var(--ok) 30%, transparent);
      background: color-mix(in srgb, var(--ok) 12%, transparent);
      color: var(--ok);
    }
    [data-tone='warn'].pill,
    [data-tone='warn'].chip {
      border-color: color-mix(in srgb, var(--warn) 30%, transparent);
      background: color-mix(in srgb, var(--warn) 12%, transparent);
      color: var(--warn);
    }
    [data-tone='bad'].pill,
    [data-tone='bad'].chip {
      border-color: color-mix(in srgb, var(--danger) 30%, transparent);
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      color: var(--danger);
    }
    [data-tone='info'].pill {
      border-color: color-mix(in srgb, var(--info) 30%, transparent);
      background: color-mix(in srgb, var(--info) 12%, transparent);
      color: #bfdbfe;
    }

    .status {
      border: 1px solid var(--border-strong);
      font-family: var(--mono);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .status[data-status='good'] {
      border-color: color-mix(in srgb, var(--ok) 30%, transparent);
      background: color-mix(in srgb, var(--ok) 12%, transparent);
      color: var(--ok);
    }
    .status[data-status='warn'] {
      border-color: color-mix(in srgb, var(--warn) 30%, transparent);
      background: color-mix(in srgb, var(--warn) 12%, transparent);
      color: var(--warn);
    }
    .status[data-status='bad'] {
      border-color: color-mix(in srgb, var(--danger) 30%, transparent);
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      color: var(--danger);
    }
    .method {
      min-width: 52px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--surface-2);
      color: var(--text);
      font-family: var(--mono);
      font-weight: 600;
      text-align: center;
    }
    .method[data-method='GET'] {
      border-color: color-mix(in srgb, #7dd3fc 30%, transparent);
      background: color-mix(in srgb, #7dd3fc 12%, transparent);
      color: #7dd3fc;
    }
    .method[data-method='POST'] {
      border-color: color-mix(in srgb, var(--ok) 30%, transparent);
      background: color-mix(in srgb, var(--ok) 12%, transparent);
      color: #86efac;
    }
    .method[data-method='PUT'],
    .method[data-method='PATCH'] {
      border-color: color-mix(in srgb, var(--warn) 30%, transparent);
      background: color-mix(in srgb, var(--warn) 12%, transparent);
      color: #fde68a;
    }
    .method[data-method='DELETE'] {
      border-color: color-mix(in srgb, var(--danger) 30%, transparent);
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      color: #fecaca;
    }
    .request {
      min-width: 260px;
    }
    .request .url {
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    details {
      margin-top: 8px;
    }
    summary {
      width: fit-content;
      border-radius: 6px;
      color: var(--text-2);
      font-size: 12px;
      cursor: pointer;
      transition: color 160ms var(--ease);
    }
    summary:hover {
      color: var(--text);
    }
    .code {
      margin: 8px 0 0;
      padding: 10px 12px;
      max-height: 220px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.55;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .calls-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .segmented {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 2px;
      justify-self: start;
      margin: 0;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
    }
    .segmented label {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 5px 12px;
      border-radius: 7px;
      background: transparent;
      color: var(--text-2);
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 180ms var(--ease),
        color 180ms var(--ease),
        box-shadow 180ms var(--ease);
    }
    .segmented label:hover {
      color: var(--text);
    }
    .segmented label .muted {
      color: var(--text-3);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .segmented label.on {
      background: var(--surface-3);
      color: var(--text-strong);
      box-shadow: inset 0 0 0 1px var(--border-strong);
    }
    .segmented label.on .muted {
      color: var(--text-2);
    }

    h2 {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 8px 0 0;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .card {
      display: grid;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
      animation: enter 0.35s var(--ease) both;
    }
    .card h2 {
      margin: 0;
    }
    .check {
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--text-2);
      cursor: pointer;
    }
    .check input {
      width: 15px;
      height: 15px;
      margin: 0;
      accent-color: var(--accent);
    }
    .check input:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .response {
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }
    .response .code {
      margin: 0;
    }
    .facts {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 10px 16px;
      margin: 0;
    }
    .facts dt {
      padding-top: 3px;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .facts dd {
      margin: 0;
    }

    .findings {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
      animation: enter 0.35s var(--ease) both;
    }
    .findings > li {
      position: relative;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow:
        inset 3px 0 0 var(--info),
        var(--shadow);
      transition: border-color 180ms var(--ease);
    }
    .findings > li:hover {
      border-color: var(--border-strong);
    }
    .findings > li[data-tone='bad'] {
      box-shadow:
        inset 3px 0 0 var(--danger),
        var(--shadow);
    }
    .findings > li[data-tone='warn'] {
      box-shadow:
        inset 3px 0 0 var(--warn),
        var(--shadow);
    }
    .findings p {
      margin: 8px 0 0;
      line-height: 1.55;
    }
    .findings > li > p {
      color: var(--text-2);
    }
    .finding-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .finding-title {
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
    }
    .where {
      display: grid;
      gap: 6px;
      margin: 12px 0 0;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      list-style: none;
    }
    .where li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .where .detail {
      flex-basis: 100%;
      margin: 0;
      color: var(--text-2);
      overflow-wrap: anywhere;
    }
    .fix {
      margin-top: 12px;
      color: var(--text);
      line-height: 1.55;
    }
    .fix strong {
      display: block;
      margin-bottom: 4px;
      color: var(--ok);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .rule {
      display: block;
      margin-top: 12px;
      color: var(--text-3);
      font-size: 12px;
    }

    .empty {
      display: grid;
      gap: 8px;
      justify-items: center;
      padding: 40px 24px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      text-align: center;
      animation: enter 0.35s var(--ease) both;
    }
    .empty p {
      margin: 0;
      max-width: 520px;
      line-height: 1.6;
    }
    .empty-title {
      margin: 0;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 600;
    }
  `,
})
export class AnalogInspector {
  rpc = input<DevframeRpcClient | null>(null);
  readonly canCall = computed(() => actionAllowed(this.rpc(), 'analog'));
  protected readonly callsOff = actionBlockedMessage('analog');

  readonly kinds: Kind[] = ['all', 'page', 'load', 'action', 'fn', 'api'];
  readonly methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  readonly methodOptions = this.methods.map((m) => ({ value: m, label: m }));
  readonly view = signal<View>('routes');
  readonly project = signal<AnalogProject | null>(null);
  readonly state = signal<AnalogState>({});
  readonly findings = signal<Finding[]>([]);
  readonly renderRows = signal<RenderRow[]>([]);
  readonly plan = signal<PrerenderPlan | null>(null);
  readonly filter = signal('');
  readonly testUrl = signal('');
  readonly explained = signal<{ url: string; match: UrlMatch } | null>(null);
  readonly explainError = signal('');
  readonly explaining = signal(false);
  readonly kind = signal<Kind>('all');
  readonly method = signal('GET');
  readonly apiPath = signal('');
  readonly apiBody = signal('');
  readonly confirmSend = signal(false);
  readonly response = signal<ApiResult | null>(null);
  readonly sending = signal(false);
  readonly needsConfirm = computed(() => this.method() !== 'GET' && !this.confirmSend());
  readonly canSend = computed(() => this.canCall() && !this.sending() && !this.needsConfirm());
  readonly sendHintId = computed(() =>
    !this.canCall() ? 'analog-calls-off' : this.needsConfirm() ? 'analog-confirm-hint' : null,
  );

  private unsubscribe: (() => void) | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshRun = 0;
  private readonly destroyRef = inject(DestroyRef);

  readonly page = computed(() => this.state().pages?.[0] ?? null);
  readonly openFiles = computed(() => new Set((this.page()?.chain ?? []).map((c) => c.file)));
  readonly allCalls = computed(() => this.state().calls ?? []);
  readonly calls = computed(() => {
    const kind = this.kind();
    return this.allCalls()
      .filter((c) => kind === 'all' || c.kind === kind)
      .slice(-150)
      .reverse();
  });
  readonly allRoutes = computed(() => walk(this.project()?.routes ?? []));
  readonly pageCount = computed(
    () => this.allRoutes().filter((r) => r.route.file && r.route.kind !== 'layout').length,
  );
  readonly routeRows = computed(() => {
    const needle = this.filter().trim().toLowerCase();
    if (!needle) return this.allRoutes();
    return this.allRoutes().filter(
      (r) =>
        r.route.fullPath.toLowerCase().includes(needle) ||
        !!r.route.file?.toLowerCase().includes(needle),
    );
  });
  readonly serverFns = computed(() => this.project()?.serverFns ?? []);
  private readonly fnById = computed(() => new Map(this.serverFns().map((fn) => [fn.id, fn])));
  readonly refetchedFns = computed(() =>
    Array.from(
      new Set((this.state().refetches ?? []).map((r) => this.fnById().get(r.id)?.name ?? r.id)),
    ),
  );
  readonly duplicates = computed(() =>
    Array.from(new Set((this.state().duplicates ?? []).map((d) => d.route))),
  );
  readonly modeCounts = computed(() =>
    (['ssr', 'ssg', 'cached', 'client', 'redirect'] as const)
      .map((mode) => ({
        mode,
        label: MODE_LABEL[mode],
        count: this.renderRows().filter((r) => r.mode === mode).length,
      }))
      .filter((m) => m.count),
  );
  readonly lintCards = computed(() => {
    const order = { error: 0, warning: 1, info: 2 };
    const cards = new Map<string, LintCard>();
    for (const finding of this.findings()) {
      let card = cards.get(finding.rule);
      if (!card) {
        const known = LINT_TEXT[finding.rule];
        card = {
          rule: finding.rule,
          severity: finding.severity,
          title: known?.title ?? finding.rule,
          summary: known?.summary ?? finding.message,
          fix: finding.fix,
          items: [],
        };
        cards.set(finding.rule, card);
      }
      const message =
        STATIC_MESSAGES.has(finding.rule) || finding.message === card.summary
          ? undefined
          : finding.message;
      const same = (item: LintCard['items'][number]) =>
        item.file === finding.file && item.path === finding.path && item.message === message;
      if (!card.items.some(same))
        card.items.push({ file: finding.file, path: finding.path, message });
    }
    return Array.from(cards.values()).sort((a, b) => order[a.severity] - order[b.severity]);
  });
  readonly views = computed(() => {
    const errors = this.findings().length;
    return [
      { id: 'routes' as View, label: 'Routes', count: this.pageCount(), tone: '' },
      { id: 'server' as View, label: 'Server', count: this.allCalls().length, tone: '' },
      { id: 'render' as View, label: 'Render', count: this.renderRows().length, tone: '' },
      {
        id: 'content' as View,
        label: 'Content',
        count: this.project()?.content.length ?? 0,
        tone: '',
      },
      { id: 'lint' as View, label: 'Lint', count: errors, tone: errors ? 'warn' : '' },
    ];
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) untracked(() => void this.load(client));
    });
    effect(() => {
      const view = this.view();
      this.state();
      untracked(() => this.scheduleRefresh(view));
    });
    this.destroyRef.onDestroy(() => {
      this.unsubscribe?.();
      clearTimeout(this.refreshTimer);
    });
  }

  private async load(client: DevframeRpcClient) {
    const project = await call<AnalogProject>(client, 'analog-project');
    if (this.destroyRef.destroyed) return;
    this.project.set(project);
    try {
      const shared = await client.scope('ng-devtools').rpc.sharedState('analog');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.state.set((value as AnalogState) ?? {});
      apply(shared.value());
      this.unsubscribe?.();
      this.unsubscribe = shared.on('updated', apply);
    } catch {
      this.state.set({});
    }
    if (this.destroyRef.destroyed) return;
    await this.refresh(this.view());
  }

  private scheduleRefresh(view: View) {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refresh(view), 300);
  }

  private async refresh(view: View) {
    const client = this.rpc();
    if (!client) return;
    const run = ++this.refreshRun;
    const [findings, render] = await Promise.all([
      call<Finding[]>(client, 'analog-lint'),
      call<{ rows: RenderRow[]; plan: PrerenderPlan }>(client, 'analog-render'),
    ]);
    if (run !== this.refreshRun) return;
    this.findings.set(findings ?? []);
    this.renderRows.set(render?.rows ?? []);
    this.plan.set(render?.plan ?? null);
    if (view === 'routes' || view === 'content') {
      const project = await call<AnalogProject>(client, 'analog-project');
      if (project && run === this.refreshRun) this.project.set(project);
    }
  }

  isOpen(route: AnalogRoute): boolean {
    return !!route.file && this.openFiles().has(route.file);
  }

  kindText(route: AnalogRoute): string {
    if (route.catchAll) return route.catchAll === 'optional' ? 'optional catch-all' : 'catch-all';
    if (route.kind === 'implicit') return 'folder';
    return route.kind;
  }

  serverExports(route: AnalogRoute): string[] {
    return (route.serverExports ?? []).filter((e) => e === 'load' || e === 'action');
  }

  short(file: string | undefined): string | undefined {
    return file?.replace(/^\/src\/app\//, '').replace(/^\//, '');
  }

  dir(file: string): string {
    const short = this.short(file) ?? file;
    return short.includes('/') ? short.slice(0, short.lastIndexOf('/') + 1) : '';
  }

  base(file: string): string {
    return file.slice(file.lastIndexOf('/') + 1);
  }

  paramList(params: Record<string, string>): [string, string][] {
    return Object.entries(params);
  }

  kindLabel(kind: Kind): string {
    return KIND_LABEL[kind];
  }

  kindCount(kind: Kind): number {
    return kind === 'all'
      ? this.allCalls().length
      : this.allCalls().filter((c) => c.kind === kind).length;
  }

  modeLabel(mode: RenderRow['mode']): string {
    return MODE_LABEL[mode];
  }

  mismatch(row: RenderRow): boolean {
    if (!row.last?.render || row.mode === 'redirect') return false;
    return row.mode === 'client' ? row.last.render !== 'client' : row.last.render === 'client';
  }

  fnOf(call: AnalogCall): ServerFn | undefined {
    return call.kind === 'fn' && call.route ? this.fnById().get(call.route) : undefined;
  }

  fnCalls(id: string): number {
    return this.allCalls().filter((c) => c.kind === 'fn' && c.route === id).length;
  }

  outcomeLabel(outcome: ActionOutcome): string {
    return OUTCOME_LABEL[outcome];
  }

  outcomeTone(outcome: ActionOutcome): string {
    return OUTCOME_TONE[outcome];
  }

  statusClass(status: number): 'good' | 'warn' | 'bad' {
    if (status >= 500 || status === 0) return 'bad';
    if (status >= 400) return 'warn';
    return 'good';
  }

  tone(severity: Finding['severity']): 'bad' | 'warn' | 'info' {
    return severity === 'error' ? 'bad' : severity === 'warning' ? 'warn' : 'info';
  }

  shadowed(file: string): string | undefined {
    const finding = this.findings().find(
      (f) => f.rule === 'content-shadows-page' && f.file === file,
    );
    return finding?.message.match(/(\/\S+\.page\.ts)/)?.[1];
  }

  contentUrl(file: string): string | undefined {
    return this.allRoutes().find((r) => r.route.file === file)?.route.fullPath;
  }

  pretty(text: string): string {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  readonly time = time;

  tryApi(api: ApiRoute) {
    this.method.set(api.method === 'ANY' ? 'GET' : api.method);
    this.apiPath.set(api.path.replace(/:(\w+)/g, '1').replace('**', 'x'));
    this.response.set(null);
    queueMicrotask(() => document.getElementById('api-path')?.focus());
  }

  async clearCalls() {
    await call(this.rpc(), 'analog-clear-calls');
  }

  async explain() {
    const url = this.testUrl().trim();
    if (!url) {
      this.explained.set(null);
      this.explainError.set('Type a URL to explain, for example /products/42.');
      return;
    }
    this.explaining.set(true);
    this.explainError.set('');
    try {
      const match = (await rpcCall(this.rpc(), 'analog-explain-url', url)) as UrlMatch | null;
      if (!match) throw new Error('The devtools server did not answer');
      this.explained.set({ url, match });
    } catch (error) {
      const reason = String((error as Error)?.message || 'The devtools server did not answer');
      this.explained.set(null);
      this.explainError.set(`Could not explain ${url}. ${reason.replace(/\.?$/, '.')}`);
    } finally {
      this.explaining.set(false);
    }
  }

  async send() {
    const path = this.apiPath().trim();
    if (!path || this.sending() || this.needsConfirm()) return;
    let body: unknown;
    if (this.method() !== 'GET' && this.apiBody().trim()) {
      try {
        body = JSON.parse(this.apiBody());
      } catch {
        this.response.set({ error: 'The body is not valid JSON.' });
        return;
      }
    }
    this.response.set(null);
    this.sending.set(true);
    try {
      const result = await call<ApiResult>(this.rpc(), 'analog-call-api', {
        method: this.method(),
        path,
        body,
        confirm: this.confirmSend(),
      });
      this.response.set(result ?? { error: 'No answer from the devtools server.' });
    } finally {
      this.sending.set(false);
    }
  }

  onKey(event: KeyboardEvent) {
    const order = this.views().map((v) => v.id);
    const index = order.indexOf(this.view());
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + order.length) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    else return;
    event.preventDefault();
    this.view.set(order[next]);
    const host = event.currentTarget as HTMLElement;
    queueMicrotask(() => host.querySelector<HTMLElement>(`#analog-tab-${order[next]}`)?.focus());
  }
}
