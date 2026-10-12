export const PANGULAR_INSPECTORS = [
  'components',
  'injectors',
  'signals',
  'ngrx',
  'forms',
  'router',
  'pipes',
  'http',
  'analog',
  'capacitor',
] as const;

export type PangularInspector = (typeof PANGULAR_INSPECTORS)[number];

/**
 * The hub docks that open one view of the panel. The hub registers them and
 * the panel follows them, so both read this one list.
 */
export const HUB_VIEWS = [
  'angular',
  'ngrx',
  'analog',
  'angular-native',
  'nativescript',
  'capacitor',
] as const;

export type HubView = (typeof HUB_VIEWS)[number];

/** The view name that opens the full panel, with every tab. */
export const HUB_ALL_TOOLS = 'all';

/** The hub dock id of a view (a `HUB_VIEWS` entry or `HUB_ALL_TOOLS`). */
export function hubDockId(view: string): string {
  return `pangular:${view}`;
}

export const PANGULAR_ACTIONS = [
  'forms',
  'router',
  'ngrx',
  'http',
  'analog',
  'components',
] as const;

export type PangularAction = (typeof PANGULAR_ACTIONS)[number];

/** Default, minimum and maximum of each `limits` option. Values outside are clamped. */
export const PANGULAR_LIMITS = {
  refreshMs: { default: 3000, min: 500, max: 8000 },
  navigations: { default: 50, min: 5, max: 500 },
  formTimeline: { default: 200, min: 10, max: 2000 },
  httpCalls: { default: 200, min: 10, max: 2000 },
  changeLog: { default: 200, min: 10, max: 2000 },
  cdCycles: { default: 200, min: 10, max: 2000 },
  capacitorCalls: { default: 200, min: 10, max: 2000 },
} as const;

export type PangularLimit = keyof typeof PANGULAR_LIMITS;

/** Why Angular's transfer cache did not store a server response. */
export const CACHE_SKIP_TEXT = {
  'opted-out': 'the request sets transferCache: false',
  post: 'POST requests are left out unless includePostRequests is set',
  method: 'only GET, HEAD and POST requests are cached',
  'auth-headers': 'it sends an Authorization, Proxy-Authorization or Cookie header',
  credentials: 'it sends credentials (withCredentials or credentials: include/same-origin)',
  'no-cache-request': 'the request asks for no-store, no-cache or private',
  'no-cache-response': 'the response has Cache-Control no-store, no-cache or private',
  'set-cookie': 'the response sets a cookie',
  error: 'failed responses are not stored',
  mocked: 'a fault rule answered before the transfer cache ran',
  'cache-off-or-filter':
    'the transfer cache is off, or its filter (or another withHttpTransferCacheOptions setting) left it out',
} as const;

export type CacheSkip = keyof typeof CACHE_SKIP_TEXT;

export const HTTP_RULE_STATUSES: readonly (readonly [status: number, reason: string])[] = [
  [200, 'OK'],
  [201, 'Created'],
  [202, 'Accepted'],
  [203, 'Non-Authoritative Information'],
  [204, 'No Content'],
  [205, 'Reset Content'],
  [206, 'Partial Content'],
  [207, 'Multi-Status'],
  [208, 'Already Reported'],
  [226, 'IM Used'],
  [300, 'Multiple Choices'],
  [301, 'Moved Permanently'],
  [302, 'Found'],
  [303, 'See Other'],
  [304, 'Not Modified'],
  [307, 'Temporary Redirect'],
  [308, 'Permanent Redirect'],
  [400, 'Bad Request'],
  [401, 'Unauthorized'],
  [402, 'Payment Required'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [405, 'Method Not Allowed'],
  [406, 'Not Acceptable'],
  [407, 'Proxy Authentication Required'],
  [408, 'Request Timeout'],
  [409, 'Conflict'],
  [410, 'Gone'],
  [411, 'Length Required'],
  [412, 'Precondition Failed'],
  [413, 'Content Too Large'],
  [414, 'URI Too Long'],
  [415, 'Unsupported Media Type'],
  [416, 'Range Not Satisfiable'],
  [417, 'Expectation Failed'],
  [418, "I'm a Teapot"],
  [421, 'Misdirected Request'],
  [422, 'Unprocessable Content'],
  [423, 'Locked'],
  [424, 'Failed Dependency'],
  [425, 'Too Early'],
  [426, 'Upgrade Required'],
  [428, 'Precondition Required'],
  [429, 'Too Many Requests'],
  [431, 'Request Header Fields Too Large'],
  [451, 'Unavailable For Legal Reasons'],
  [499, 'Client Closed Request'],
  [500, 'Internal Server Error'],
  [501, 'Not Implemented'],
  [502, 'Bad Gateway'],
  [503, 'Service Unavailable'],
  [504, 'Gateway Timeout'],
  [505, 'HTTP Version Not Supported'],
  [506, 'Variant Also Negotiates'],
  [507, 'Insufficient Storage'],
  [508, 'Loop Detected'],
  [510, 'Not Extended'],
  [511, 'Network Authentication Required'],
  [520, 'Web Server Returned an Unknown Error'],
  [521, 'Web Server Is Down'],
  [522, 'Connection Timed Out'],
  [523, 'Origin Is Unreachable'],
  [524, 'A Timeout Occurred'],
];

export function isHttpRuleStatus(status: unknown): status is number {
  return HTTP_RULE_STATUSES.some(([code]) => code === status);
}

/**
 * Options shared by `initPangularHub()`, the Vite plugin and
 * `createPangular()`. Everything is on when left out.
 */
export interface PangularConfig {
  /** Turn an inspector off: no tab or dock, no page collector, no RPC and no agent tools. */
  inspectors?: Partial<Record<PangularInspector, boolean>>;
  agent?: {
    /** Drop every agent tool that is not a `read` tool (see `AgentSafety`). */
    readOnly?: boolean;
    /** Hide one inspector's agent tools and resources while keeping its tab. */
    tools?: Partial<Record<PangularInspector, boolean>>;
  };
  /** Allow or block writes from the panel and the agent. `false` blocks them all. */
  actions?: boolean | Partial<Record<PangularAction, boolean>>;
  redaction?: {
    /**
     * Field names to treat as secret on top of the built-in list, matched by
     * words like it: `passport` also covers `passportNumber`.
     */
    secretNames?: string[];
    /** Field names to show even when they look secret, like `window.__PANGULAR_FORMS__.unmask`. */
    unmask?: string[];
  };
  limits?: {
    /**
     * How often the page polls for changes, in ms, when it can't follow change
     * detection, such as before the app bootstraps. Also sets the
     * Analog runtime refresh. Default 3000, from 500 to 8000.
     */
    refreshMs?: number;
    /** Navigations kept per page. Default 50. */
    navigations?: number;
    /** Form timeline events kept. Default 200. */
    formTimeline?: number;
    /** HTTP calls kept per page and on the server. Default 200. */
    httpCalls?: number;
    /** NgRx change log entries kept per page. Default 200. */
    changeLog?: number;
    /** Change detection cycles kept per page while recording. Default 200. */
    cdCycles?: number;
    /** Capacitor plugin calls kept per page and on the server. Default 200. */
    capacitorCalls?: number;
  };
}

export interface ResolvedPangularConfig {
  inspectors: Record<PangularInspector, boolean>;
  agent: { readOnly: boolean; tools: Record<PangularInspector, boolean> };
  actions: Record<PangularAction, boolean>;
  redaction: { secretNames: string[]; unmask: string[] };
  limits: Record<PangularLimit, number>;
}

export const PANGULAR_CONFIG_KEY = 'pangular';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

const MAX_NAMES = 100;
const MAX_NAME_LENGTH = 100;

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const trimmed = value
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim())
    .filter((name) => name && name.length <= MAX_NAME_LENGTH);
  return [...new Set(trimmed)].slice(0, MAX_NAMES);
}

function limit(value: unknown, key: PangularLimit): number {
  const { default: fallback, min, max } = PANGULAR_LIMITS[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function flags<K extends string>(
  keys: readonly K[],
  value: (key: K) => boolean,
): Record<K, boolean> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, boolean>;
}

/** Fills in the defaults. Accepts untrusted input, and its own output unchanged. */
export function resolvePangularConfig(config?: unknown): ResolvedPangularConfig {
  const input = record(config);
  const agent = record(input['agent']);
  const inspectorInput = record(input['inspectors']);
  const toolInput = record(agent['tools']);
  const actionInput = record(input['actions']);
  const allActions = flag(input['actions'], true);
  const redaction = record(input['redaction']);
  const limits = record(input['limits']);
  const inspectors = flags(PANGULAR_INSPECTORS, (key) => flag(inspectorInput[key], true));
  return {
    inspectors,
    agent: {
      readOnly: flag(agent['readOnly'], false),
      tools: flags(PANGULAR_INSPECTORS, (key) => inspectors[key] && flag(toolInput[key], true)),
    },
    actions: flags(
      PANGULAR_ACTIONS,
      (key) => inspectors[key] && flag(actionInput[key], allActions),
    ),
    redaction: {
      secretNames: names(redaction['secretNames']),
      unmask: names(redaction['unmask']),
    },
    limits: Object.fromEntries(
      (Object.keys(PANGULAR_LIMITS) as PangularLimit[]).map((key) => [
        key,
        limit(limits[key], key),
      ]),
    ) as Record<PangularLimit, number>,
  };
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

function suggest(key: string, known: readonly string[]): string {
  const lower = key.toLowerCase();
  const best = known
    .map((name) => ({ name, cost: distance(lower, name.toLowerCase()) }))
    .sort((a, b) => a.cost - b.cost)[0];
  return best && best.cost <= Math.max(1, Math.floor(best.name.length / 3))
    ? ` Did you mean \`${best.name}\`?`
    : '';
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value === 'string' ? `the string ${JSON.stringify(value)}` : `a ${typeof value}`;
}

const CONFIG_KEYS = ['inspectors', 'agent', 'actions', 'redaction', 'limits'] as const;

/**
 * Lists what `resolvePangularConfig()` ignores or changes in `config`:
 * unknown keys, values of the wrong type and limits outside their range.
 */
export function pangularConfigProblems(config: unknown): string[] {
  const problems: string[] = [];
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
  const object = (path: string, value: unknown, known: readonly string[]) => {
    if (value === undefined) return {};
    if (!isRecord(value)) {
      problems.push(`\`${path}\` should be an object, got ${describe(value)}. It was ignored.`);
      return {};
    }
    for (const key of Object.keys(value)) {
      if (!known.includes(key)) {
        const name = path ? `${path}.${key}` : key;
        problems.push(`Unknown option \`${name}\` was ignored.${suggest(key, known)}`);
      }
    }
    return value;
  };
  const boolean = (path: string, value: unknown, fallback: string) => {
    if (value !== undefined && typeof value !== 'boolean') {
      problems.push(
        `\`${path}\` should be true or false, got ${describe(value)}. It was ignored, so it is ${fallback}.`,
      );
    }
  };
  const booleans = (path: string, value: unknown, known: readonly string[], fallback: string) => {
    const entries = object(path, value, known);
    for (const key of known) boolean(`${path}.${key}`, entries[key], fallback);
  };

  if (config === undefined || config === null) return problems;
  const input = object('', config, CONFIG_KEYS);
  booleans('inspectors', input['inspectors'], PANGULAR_INSPECTORS, 'on');
  const agent = object('agent', input['agent'], ['readOnly', 'tools']);
  boolean('agent.readOnly', agent['readOnly'], 'off');
  booleans('agent.tools', agent['tools'], PANGULAR_INSPECTORS, 'on');
  const actions = input['actions'];
  if (typeof actions !== 'boolean') {
    if (actions !== undefined && !isRecord(actions)) {
      problems.push(
        `\`actions\` should be true, false or an object, got ${describe(actions)}. It was ignored, so every action is allowed.`,
      );
    } else {
      booleans('actions', actions, PANGULAR_ACTIONS, 'allowed');
    }
  }
  const redaction = object('redaction', input['redaction'], ['secretNames', 'unmask']);
  for (const key of ['secretNames', 'unmask'] as const) {
    const value = redaction[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      problems.push(
        `\`redaction.${key}\` should be an array of names, got ${describe(value)}. It was ignored.`,
      );
      continue;
    }
    const dropped = value.filter(
      (name) => typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME_LENGTH,
    );
    if (dropped.length) {
      problems.push(
        `\`redaction.${key}\` has ${dropped.length} entries that are not names of 1 to ${MAX_NAME_LENGTH} characters. They were ignored.`,
      );
    }
    if (value.length - dropped.length > MAX_NAMES) {
      problems.push(`\`redaction.${key}\` keeps the first ${MAX_NAMES} names only.`);
    }
  }
  const limits = object('limits', input['limits'], Object.keys(PANGULAR_LIMITS));
  for (const key of Object.keys(PANGULAR_LIMITS) as PangularLimit[]) {
    const value = limits[key];
    if (value === undefined) continue;
    const used = limit(value, key);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      problems.push(
        `\`limits.${key}\` should be a number, got ${describe(value)}. It was ignored, so it is ${used}.`,
      );
    } else if (used !== value) {
      const { min, max } = PANGULAR_LIMITS[key];
      problems.push(
        `\`limits.${key}\` is ${value}, which is outside ${min} to ${max} or not whole. It was set to ${used}.`,
      );
    }
  }
  return problems;
}

/** The startup warning for `pangularConfigProblems()`, or `undefined` when there are none. */
export function pangularConfigWarning(config: unknown): string | undefined {
  const problems = pangularConfigProblems(config);
  if (!problems.length) return undefined;
  return `[pangular] The devtools config has ${problems.length === 1 ? 'a problem' : `${problems.length} problems`}:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`;
}

/** Reads the config a server published in its connection info (`connectionMeta.configs`). */
export function configFromConnection(
  meta: { configs?: object } | undefined,
): ResolvedPangularConfig {
  const configs = meta?.configs as Record<string, unknown> | undefined;
  return resolvePangularConfig(configs?.[PANGULAR_CONFIG_KEY]);
}

/** Splits the devtools config out of a larger options object. */
export function pickPangularConfig<T extends PangularConfig>(
  options: T,
): { config: PangularConfig; rest: Omit<T, keyof PangularConfig> } {
  const { inspectors, agent, actions, redaction, limits, ...rest } = options;
  return { config: { inspectors, agent, actions, redaction, limits }, rest };
}

/** Form actions that work without a `formId`: they act on the page, not on one form. */
export const FORMLESS_FORM_ACTIONS: readonly string[] = [
  'locate',
  'pick',
  'cancel-pick',
  'instrument',
];

/** Form actions that change the form or its validity, as opposed to reading or focusing it. */
export const FORM_WRITE_ACTIONS: readonly string[] = [
  'set-value',
  'fill',
  'mark-touched',
  'mark-untouched',
  'mark-dirty',
  'mark-pristine',
  'touch-all',
  'revalidate',
  'reset',
  'enable',
  'disable',
  'submit',
  'restore',
];

/** Router actions that start, stop, repeat or probe a navigation. */
export const ROUTER_WRITE_ACTIONS: readonly string[] = ['navigate', 'abort', 'replay', 'probe'];

/**
 * Agent tools that perform an action's writes; blocking the action drops them,
 * except the tools in `ACTION_TOOL_FREE_MODES`.
 */
export const ACTION_TOOLS: Record<PangularAction, readonly string[]> = {
  forms: ['form-action', 'fill-form'],
  router: ['navigate', 'clear-recordings'],
  ngrx: ['dispatch-ngrx-action'],
  http: ['set-http-rule', 'remove-http-rule', 'clear-recordings'],
  analog: ['analog-call-api', 'clear-recordings'],
  components: ['set-component-property', 'set-signal'],
};

/**
 * Action tools with modes that work while their action is blocked. Blocking
 * the action keeps the tool, and its handler refuses the other modes.
 */
export const ACTION_TOOL_FREE_MODES: Record<string, readonly string[]> = {
  navigate: ['instrument', 'resolve-lazy'],
};

/**
 * How much an agent tool can change, sent to MCP clients as the tool's
 * `readOnlyHint` and `destructiveHint`.
 * - `read`: only reads the app, the page or the source.
 * - `action`: changes the running page, the server's mock rules or what the
 *   page records, in a way the next action or a reload undoes.
 * - `destructive`: can lose data: it erases recordings, or sends writes to
 *   the app's own API routes.
 */
export type AgentSafety = 'read' | 'action' | 'destructive';

/** The tier of every agent tool that is not `read`, without the `pangular:` prefix. */
export const AGENT_SAFETY: Record<string, Exclude<AgentSafety, 'read'>> = {
  'form-action': 'action',
  'fill-form': 'action',
  navigate: 'action',
  'dispatch-ngrx-action': 'action',
  'set-http-rule': 'action',
  'remove-http-rule': 'action',
  'record-pipes': 'action',
  'watch-signal': 'action',
  'change-detection': 'action',
  'clear-recordings': 'destructive',
  'analog-call-api': 'destructive',
  'set-component-property': 'action',
  'set-signal': 'action',
};

/**
 * Tools that `agent.readOnly` keeps as `read` tools, with the arguments that
 * act refused: `change-detection` still answers, but without `record`.
 */
export const READ_ONLY_VARIANTS: readonly string[] = ['change-detection'];

/** The tier an agent tool or resource is registered with under `config`. Resources are `read`. */
export function agentSafety(id: string, config: ResolvedPangularConfig): AgentSafety {
  const name = agentName(id);
  if (config.agent.readOnly && READ_ONLY_VARIANTS.includes(name)) return 'read';
  return AGENT_SAFETY[name] ?? 'read';
}

export function actionBlockedMessage(action: PangularAction): string {
  const what = {
    forms: 'Writing to forms',
    router: 'Navigating and clearing navigations',
    ngrx: 'Restoring NgRx state and dispatching actions',
    http: 'Changing HTTP mock rules and clearing HTTP calls',
    analog: 'Calling API routes and clearing server calls',
    components: 'Editing component properties and signals',
  }[action];
  return `${what} is turned off in the devtools config (actions.${action}).`;
}

/**
 * Server RPC functions that belong to no inspector, so turning inspectors off
 * keeps them. `open-in-editor` launches the editor on the dev machine for a
 * file inside the project root; it is not an agent tool.
 */
export const SHARED_RPC: readonly string[] = [
  'build-meta',
  'claim-page',
  'report-page-visibility',
  'list-pages',
  'open-in-editor',
  'hub-dock-seen',
  // Store as global spans the components, injectors and NgRx inspectors; the
  // handler checks that the inspector of each request is on.
  'request-console-global',
  'console-global-result',
];

/**
 * The inspector each server RPC function belongs to. A function missing here
 * is shared and always registered.
 */
export const RPC_INSPECTOR: Record<string, PangularInspector> = {
  'get-components': 'components',
  'push-component-tree': 'components',
  'push-change-detection': 'components',
  'ping-change-detection': 'components',
  'forget-change-detection-page': 'components',
  'request-change-detection-record': 'components',
  'request-change-detection-options': 'components',
  'ping-component-tree': 'components',
  'forget-component-page': 'components',
  'select-component': 'components',
  'request-component-pick': 'components',
  'cancel-component-pick': 'components',
  'component-pick-result': 'components',
  'request-page-highlight': 'components',
  'request-component-edit': 'components',
  'component-edit-result': 'components',
  'get-signals': 'signals',
  'push-signal-graph': 'signals',
  'ping-signal-graph': 'signals',
  'forget-signal-page': 'signals',
  'select-signal-target': 'signals',
  'set-signal-watch': 'signals',
  'signal-graph-peek-result': 'signals',
  'get-providers': 'injectors',
  'push-injector-tree': 'injectors',
  'ping-injector-tree': 'injectors',
  'forget-injector-page': 'injectors',
  'get-ngrx-store': 'ngrx',
  'push-ngrx-state': 'ngrx',
  'forget-ngrx-page': 'ngrx',
  'ngrx-action-result': 'ngrx',
  'request-ngrx-action': 'ngrx',
  'push-forms': 'forms',
  'forget-forms-page': 'forms',
  'request-form-highlight': 'forms',
  'form-action-result': 'forms',
  'request-form-action': 'forms',
  'forms-lint': 'forms',
  'forms-owners': 'forms',
  'forms-explain': 'forms',
  'get-routes': 'router',
  'push-router': 'router',
  'ping-router': 'router',
  'router-action-result': 'router',
  'request-router-action': 'router',
  'router-lint': 'router',
  'router-match': 'router',
  'router-export': 'router',
  'forget-router-page': 'router',
  'clear-router-navigations': 'router',
  'get-pipes': 'pipes',
  'push-pipes': 'pipes',
  'forget-pipes-page': 'pipes',
  'request-instrument-pipes': 'pipes',
  'pipe-lint': 'pipes',
  'push-http': 'http',
  'ping-http': 'http',
  'forget-http-page': 'http',
  'get-http-rules': 'http',
  'set-http-rules': 'http',
  'set-ssr-overrides': 'http',
  'clear-http-calls': 'http',
  'push-capacitor': 'capacitor',
  'forget-capacitor-page': 'capacitor',
  'push-analog': 'analog',
  'forget-analog-page': 'analog',
  'analog-clear-calls': 'analog',
  'analog-project': 'analog',
  'analog-explain-url': 'analog',
  'analog-lint': 'analog',
  'analog-render': 'analog',
  'analog-text': 'analog',
  'analog-call-api': 'analog',
};

/**
 * The inspector each agent tool and resource belongs to, without the
 * `pangular:` prefix. RPC functions exposed as tools use `RPC_INSPECTOR`.
 */
export const AGENT_INSPECTOR: Record<string, PangularInspector> = {
  'component-tree': 'components',
  highlight: 'components',
  'inspect-component': 'components',
  'list-components': 'components',
  'defer-blocks': 'components',
  'for-blocks': 'components',
  'change-detection': 'components',
  'set-component-property': 'components',
  'set-signal': 'components',
  'signal-graph': 'signals',
  'inspect-signals': 'signals',
  'watch-signal': 'signals',
  'injector-tree': 'injectors',
  'inspect-providers': 'injectors',
  'ngrx-store': 'ngrx',
  'dispatch-ngrx-action': 'ngrx',
  'inspect-signal-store': 'ngrx',
  'signal-store-history': 'ngrx',
  forms: 'forms',
  'inspect-forms': 'forms',
  'explain-form-invalid': 'forms',
  'explain-field': 'forms',
  'explain-submit': 'forms',
  'form-payload': 'forms',
  'form-history': 'forms',
  'form-diff': 'forms',
  'lint-forms': 'forms',
  'explain-custom-control': 'forms',
  'export-form': 'forms',
  'wait-for-form': 'forms',
  'form-action': 'forms',
  'fill-form': 'forms',
  router: 'router',
  'inspect-route': 'router',
  'explain-navigation': 'router',
  'list-routes': 'router',
  'lint-routes': 'router',
  'router-config': 'router',
  'export-navigation': 'router',
  'explain-render-mode': 'router',
  navigate: 'router',
  'lint-pipes': 'pipes',
  'explain-pipe': 'pipes',
  'record-pipes': 'pipes',
  'list-ssr-requests': 'http',
  'explain-ssr-request': 'http',
  'list-http-calls': 'http',
  'list-http-rules': 'http',
  'set-http-rule': 'http',
  'remove-http-rule': 'http',
  'clear-recordings': 'http',
  'list-capacitor-calls': 'capacitor',
  'list-capacitor-plugins': 'capacitor',
};

/**
 * The inspector behind each shared-state key, without the `pangular:` prefix.
 * MCP clients read shared state through `devframe_state_read` and the
 * `devframe://state/<key>` resources, so `agent.tools.<inspector>: false`
 * hides the key there too. The panel still gets it.
 */
export const SHARED_STATE_INSPECTOR: Record<string, PangularInspector> = {
  'component-tree': 'components',
  'change-detection': 'components',
  'signal-graph': 'signals',
  'injector-tree': 'injectors',
  'ngrx-store': 'ngrx',
  forms: 'forms',
  router: 'router',
  routes: 'router',
  'pipe-usage': 'pipes',
  http: 'http',
  'http-payloads': 'http',
  capacitor: 'capacitor',
  analog: 'analog',
};

/** Shared-state keys that belong to no inspector, without the `pangular:` prefix. */
export const SHARED_STATE_KEYS: readonly string[] = ['page-visibility'];

/**
 * Whether MCP clients may read a shared-state key. A `pangular:` key in
 * neither list stays hidden, so a new key needs an entry before agents see it.
 * Keys of the hub and of other devframes are left to them.
 */
export function sharedStateExposed(key: string, config: ResolvedPangularConfig): boolean {
  if (!key.startsWith('pangular:')) return true;
  const name = agentName(key);
  if (SHARED_STATE_KEYS.includes(name)) return true;
  const inspector = SHARED_STATE_INSPECTOR[name];
  return inspector !== undefined && config.agent.tools[inspector];
}

/**
 * Agent tools and resources that answer only while a page reports to the
 * server, or that call the app's dev server. The stdio MCP server has neither.
 */
export const PAGE_AGENT_ENTRIES: readonly string[] = [
  'list-pages',
  'clear-recordings',
  'component-tree',
  'highlight',
  'inspect-component',
  'list-components',
  'defer-blocks',
  'for-blocks',
  'change-detection',
  'set-component-property',
  'set-signal',
  'signal-graph',
  'inspect-signals',
  'watch-signal',
  'injector-tree',
  'inspect-providers',
  'ngrx-store',
  'dispatch-ngrx-action',
  'inspect-signal-store',
  'signal-store-history',
  'forms',
  'inspect-forms',
  'explain-form-invalid',
  'explain-field',
  'explain-submit',
  'form-payload',
  'form-history',
  'form-diff',
  'lint-forms',
  'explain-custom-control',
  'export-form',
  'wait-for-form',
  'form-action',
  'fill-form',
  'router',
  'inspect-route',
  'explain-navigation',
  'list-routes',
  'lint-routes',
  'router-config',
  'export-navigation',
  'navigate',
  'record-pipes',
  'analog-current-page',
  'analog-server-calls',
  'analog-call-api',
  'list-ssr-requests',
  'explain-ssr-request',
  'list-http-calls',
  'list-http-rules',
  'set-http-rule',
  'remove-http-rule',
  'list-capacitor-calls',
  'list-capacitor-plugins',
];

export function isPageAgentEntry(id: string): boolean {
  return PAGE_AGENT_ENTRIES.includes(agentName(id));
}

function agentName(id: string): string {
  return id.replace(/^pangular:/, '');
}

/** The inspector an agent tool or resource belongs to; `undefined` for shared ones. */
export function agentInspector(id: string): PangularInspector | undefined {
  const name = agentName(id);
  return (
    AGENT_INSPECTOR[name] ??
    RPC_INSPECTOR[name] ??
    (name.startsWith('analog-') ? 'analog' : undefined)
  );
}

export function rpcAllowed(name: string, config: ResolvedPangularConfig): boolean {
  const inspector = RPC_INSPECTOR[name];
  return !inspector || config.inspectors[inspector];
}

export function agentAllowed(entry: { id: string }, config: ResolvedPangularConfig): boolean {
  if (config.agent.readOnly && agentSafety(entry.id, config) !== 'read') return false;
  const name = agentName(entry.id);
  const matchingActions = ACTION_TOOL_FREE_MODES[name]
    ? []
    : PANGULAR_ACTIONS.filter((key) => ACTION_TOOLS[key].includes(name));
  if (matchingActions.length > 0 && matchingActions.every((key) => !config.actions[key])) {
    return false;
  }
  if (name === 'clear-recordings') {
    return Boolean(
      (config.agent.tools.http && config.inspectors.http && config.actions.http) ||
      (config.agent.tools.router && config.inspectors.router && config.actions.router) ||
      (config.agent.tools.analog && config.inspectors.analog && config.actions.analog),
    );
  }
  const inspector = agentInspector(entry.id);
  return !inspector || config.agent.tools[inspector];
}

const INSPECTOR_LABEL: Record<PangularInspector, string> = {
  components: 'Components',
  injectors: 'Injectors',
  signals: 'Signals',
  ngrx: 'NgRx',
  forms: 'Forms',
  router: 'Router',
  pipes: 'Pipes',
  http: 'HTTP',
  analog: 'Analog',
  capacitor: 'Capacitor',
};

const ACTION_LABEL: Record<PangularAction, string> = {
  forms: 'Form writes',
  router: 'Navigation',
  ngrx: 'NgRx restore and dispatch',
  http: 'HTTP mocking',
  analog: 'Analog API calls',
  components: 'Component edits',
};

const LIMIT_LABEL: Record<PangularLimit, (value: number) => string> = {
  refreshMs: (value) => `poll every ${value} ms`,
  navigations: (value) => `${value} navigations`,
  formTimeline: (value) => `${value} form events`,
  httpCalls: (value) => `${value} HTTP calls`,
  changeLog: (value) => `${value} NgRx changes`,
  cdCycles: (value) => `${value} change detection cycles`,
  capacitorCalls: (value) => `${value} Capacitor plugin calls`,
};

/** The options that differ from the defaults, as label and value pairs. Empty when nothing is changed. */
export function summarizePangularConfig(
  config: ResolvedPangularConfig,
): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  const add = (label: string, values: string[]) => {
    if (values.length) items.push({ label, value: values.join(', ') });
  };
  const inspectors = PANGULAR_INSPECTORS.filter((key) => config.inspectors[key]);
  add(
    'Inspectors off',
    PANGULAR_INSPECTORS.filter((key) => !config.inspectors[key]).map((key) => INSPECTOR_LABEL[key]),
  );
  add('Agent', config.agent.readOnly ? ['Read-only'] : []);
  add(
    'Hidden from the agent',
    inspectors.filter((key) => !config.agent.tools[key]).map((key) => INSPECTOR_LABEL[key]),
  );
  add(
    'Blocked actions',
    PANGULAR_ACTIONS.filter((key) => config.inspectors[key] && !config.actions[key]).map(
      (key) => ACTION_LABEL[key],
    ),
  );
  add('Extra secret names', config.redaction.secretNames);
  add('Unmasked names', config.redaction.unmask);
  add(
    'Limits',
    (Object.keys(PANGULAR_LIMITS) as PangularLimit[])
      .filter((key) => config.limits[key] !== PANGULAR_LIMITS[key].default)
      .map((key) => LIMIT_LABEL[key](config.limits[key])),
  );
  return items;
}

// Change detection recording types. They live here, in an entry without
// imports, so the panel shares them with the page instead of keeping copies.
// The sanitizer and the export formats both use are in `cd-data.ts`, the
// package's `cd-data` entry.

export interface CdCheck {
  name: string;
  checks: number;
  /** Time in the component's own template and hooks, children excluded. */
  ms: number;
}

export interface CdCycle {
  id: number;
  at: number;
  ms: number;
  /** How many times Angular synchronized the views in this tick. */
  passes: number;
  /** The output listener that ran last before the tick, when there was one. */
  trigger?: string;
  checks: number;
  components: CdCheck[];
  /** Start in ms from the start of the recording, from the high-resolution clock. */
  t?: number;
  /** Time in lifecycle hooks (`ngOnInit`, `ngDoCheck`, `ngAfterViewChecked`…) during the cycle. */
  hookMs?: number;
  /** Time in `afterRender` and `afterNextRender` callbacks during the cycle. */
  afterRenderMs?: number;
  /** Time in the output listener credited as `trigger`, nested outputs included. */
  outputMs?: number;
  /** The longest timed spans of the cycle, in start order, at most 40. */
  spans?: CdSpan[];
  /** Spans left out of `spans` past the cap. */
  droppedSpans?: number;
}

/** What a {@link CdSpan} measures. */
export type CdSpanKind = 'c' | 'h' | 'r' | 'o';

/**
 * One timed span of a cycle: an index into `CdRecording.spanNames`, the start
 * in ms from the start of the cycle (negative for the output that ran before
 * it), the duration in ms (children included), the nesting depth and the kind
 * (`CD_SPAN_KIND`: component check, lifecycle hook, afterRender or output).
 */
export type CdSpan = [name: number, start: number, ms: number, depth: number, kind: CdSpanKind];

/** Lifecycle hook time per class and hook, over the whole recording. */
export interface CdHookStat {
  /** The component or directive class that runs the hook. */
  name: string;
  /** `ngOnChanges`, `ngOnInit`, `ngDoCheck`, `ngAfterContentInit`… as Angular calls it. */
  hook: string;
  calls: number;
  ms: number;
  maxMs: number;
}

/** Output listener time per class and listener, over the whole recording. */
export interface CdOutputStat {
  /** The class whose template or host binding declares the listener. */
  name: string;
  /** The listener's function name, when it has a meaningful one. */
  listener?: string;
  calls: number;
  /** Time in the listener itself, outputs it emitted excluded. */
  ms: number;
  maxMs: number;
}

/** `afterRender` and `afterNextRender` callbacks, over the whole recording. */
export interface CdAfterRenderStat {
  /** How many times Angular ran the callbacks. */
  runs: number;
  ms: number;
  maxMs: number;
}

export interface CdComponentStat {
  name: string;
  checks: number;
  ms: number;
  maxMs: number;
  cycles: number;
}

export interface CdRecording {
  recording: boolean;
  startedAt: number | null;
  cycles: CdCycle[];
  /** Older cycles removed at `limits.cdCycles`. */
  dropped: number;
  components: CdComponentStat[];
  /**
   * Component classes checked but left out of `components`: past the 100
   * listed by self time, or past the 1000 the recorder keeps totals for.
   */
  droppedClasses?: number;
  /** Component instances checked past the 2000 that `hosts` counts. */
  droppedHosts?: number;
  /** Checks per component host, keyed by the component tree's element id. */
  hosts: Record<string, number>;
  /** Lifecycle hooks by time, at most 100. */
  hooks?: CdHookStat[];
  /** Output listeners by time, at most 100. */
  outputs?: CdOutputStat[];
  /** Hook and output rows checked past the lists' caps, left out of them. */
  droppedTimings?: number;
  afterRender?: CdAfterRenderStat;
  /** Names the cycles' `spans` point to. */
  spanNames?: string[];
}

/** The change detection views a page shows while it runs, turned on from the panel or an agent. */
export interface CdOptions {
  /** A box flashes over each component as Angular checks it. */
  flash: boolean;
  /** Component checks, hooks and outputs go to the "Pangular" track of the Chrome Performance panel. */
  track: boolean;
  /** `ng.enableProfiling()` was called. It stays on until the page reloads. */
  angularProfiling: boolean;
  /** Whether the page has `ng.enableProfiling` (Angular 20 or later, development build). */
  angularProfilingAvailable: boolean;
}

/** What a page pushes: its recording, with the page id and whether it can record. */
export interface CdReport extends CdRecording {
  pageId: string;
  /** False when the page has no profiler hook to record with (before Angular 20). */
  supported: boolean;
  /** The views the page has on; missing from pages that report none. */
  options?: CdOptions;
}
