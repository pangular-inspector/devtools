// The data the Analog page reads from the devtools server (`analog-project`, `analog-lint`,
// `analog-render` and the `analog` shared state), and the labels its views show for it.
export interface AnalogRoute {
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

export interface ApiRoute {
  path: string;
  method: string;
  file: string;
}

export interface ContentFile {
  file: string;
  slug: string;
  attributes: Record<string, string>;
  error?: string;
  schemaErrors?: string[];
}

export interface ServerFn {
  name: string;
  file: string;
  id: string;
  method: string;
}

export interface AnalogProject {
  analog: boolean;
  version?: string;
  routes: AnalogRoute[];
  api: ApiRoute[];
  middleware: string[];
  content: ContentFile[];
  serverFns?: ServerFn[];
  contentSchema?: { file: string; error?: string; unsupported?: string[] };
  contentUsage?: { file: string; api: string; line: number }[];
}

export interface RenderCheck {
  path: string;
  configured?: RenderRow['mode'];
  observed?: RenderRow['mode'];
  status?: number;
  ms?: number;
  matches?: boolean;
  note?: string;
  error?: string;
}

export type ActionOutcome = 'success' | 'redirect' | 'invalid' | 'error';

export interface AnalogCall {
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
  /** The tab the call came from, when the dev server could tell. */
  pageId?: string;
}

export interface AnalogPage {
  pageId: string;
  url: string;
  chain: { path: string; file?: string; serverFile?: string; outlet?: string }[];
  load?: { preview: string; bytes: number; keys: string[] };
  serverContext?: string;
  hydrated: number;
  hydrationErrors: string[];
}

export interface DuplicateLoad {
  route: string;
  ssrAt: number;
  browserAt: number;
}

export interface ServerFnRefetch {
  id: string;
  ssrAt: number;
  browserAt: number;
}

export interface AnalogState {
  pages?: AnalogPage[];
  calls?: AnalogCall[];
  duplicates?: DuplicateLoad[];
  refetches?: ServerFnRefetch[];
}

export interface Finding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  file?: string;
  path?: string;
  relatedFile?: string;
  message: string;
  fix: string;
}

export interface UrlMatch {
  matched: boolean;
  chain: AnalogRoute[];
  params: Record<string, string>;
  rejected: { file?: string; path: string; reason: string }[];
}

export interface RenderRow {
  path: string;
  file?: string;
  mode: 'ssr' | 'ssg' | 'client' | 'cached' | 'redirect';
  reason: string;
  last?: { render?: 'ssr' | 'client'; status: number; ms: number; at: number };
}

export interface PrerenderPlan {
  dynamicConfig: boolean;
  configPartial?: string[];
  listed: string[] | null;
  fromRules?: string[];
  staticMissing: string[];
  dynamic: string[];
  built: string[];
  notBuilt: string[];
}

export type View = 'routes' | 'server' | 'render' | 'content' | 'data' | 'runtime' | 'lint';

export interface LintCard {
  rule: string;
  severity: Finding['severity'];
  title: string;
  summary: string;
  fix: string;
  items: { file?: string; path?: string; message?: string }[];
}

export const LINT_TEXT: Record<string, { title: string; summary: string }> = {
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
  'content-schema': {
    title: 'Frontmatter does not match the content schema',
    summary: 'The keys or values differ from the JSON Schema that analog.contentSchema names.',
  },
  'content-schema-unreadable': {
    title: 'The content schema could not be used',
    summary: 'analog.contentSchema names a file that is missing, outside the project or not JSON.',
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
export type Kind = 'all' | AnalogCall['kind'];

/** Rows the call list renders at most, newest first. */
export const MAX_SHOWN_CALLS = 150;
/** Calls the dev server keeps (`MAX_CALLS` in packages/devtools/src/analog-server-log.ts). */
export const MAX_SERVER_CALLS = 200;

export const STATIC_MESSAGES = new Set([
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

export const MODE_LABEL = {
  ssr: 'SSR',
  ssg: 'Prerendered',
  client: 'Client only',
  cached: 'Cached',
  redirect: 'Redirect',
} as const;
export const KIND_LABEL: Record<Kind, string> = {
  all: 'All',
  page: 'Pages',
  load: 'load()',
  action: 'Actions',
  fn: 'Server fn',
  api: 'API',
};
export const OUTCOME_LABEL: Record<ActionOutcome, string> = {
  success: 'succeeded',
  redirect: 'redirected',
  invalid: 'validation errors',
  error: 'failed',
};
export const OUTCOME_TONE: Record<ActionOutcome, string> = {
  success: 'good',
  redirect: 'info',
  invalid: 'warn',
  error: 'bad',
};

export function walk(
  routes: AnalogRoute[],
  depth = 0,
  out: { route: AnalogRoute; depth: number }[] = [],
) {
  for (const route of routes) {
    out.push({ route, depth });
    walk(route.children, depth + 1, out);
  }
  return out;
}

// The helpers below were methods of the page; the views share them.

export function short(file: string | undefined): string | undefined {
  return file?.replace(/^\/src\/app\//, '').replace(/^\//, '');
}

export function dir(file: string): string {
  const shortened = short(file) ?? file;
  return shortened.includes('/') ? shortened.slice(0, shortened.lastIndexOf('/') + 1) : '';
}

export function base(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}

export function statusClass(status: number): 'good' | 'warn' | 'bad' {
  if (status >= 500 || status === 0) return 'bad';
  if (status >= 400) return 'warn';
  return 'good';
}

export function modeLabel(mode: RenderRow['mode']): string {
  return MODE_LABEL[mode];
}
