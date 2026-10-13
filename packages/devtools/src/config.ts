export const PANGULAR_INSPECTORS = [
  'components',
  'injectors',
  'signals',
  'ngrx',
  'tanstackQuery',
  'forms',
  'router',
  'pipes',
  'http',
  'analog',
  'capacitor',
  'errors',
  'plugins',
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
  'tanstackQuery',
  'plugins',
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
  idleAfterMs: { default: 60_000, min: 0, max: 600_000 },
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
    /**
     * Register the `read` agent tools on the page for browser agents, through
     * WebMCP (`document.modelContext`) and Chrome DevTools for agents
     * (`devtoolstooldiscovery`). Off by default, since any script on the page could
     * then call them; `true` turns them on.
     */
    browserTools?: boolean;
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
    /**
     * How long, in ms, pages keep sending the component tree, injectors,
     * change detection and forms after an agent's last call when no panel is
     * open. Idle pages only say they are still there, and send everything
     * again when a panel opens or an agent asks. `0` keeps them sending all
     * the time. Default 60000, up to 600000.
     */
    idleAfterMs?: number;
  };
  popup?: {
    /**
     * The keyboard shortcut that opens and closes the floating panel on the
     * page, such as `Alt+Shift+P` (the default) or `Mod+Shift+I`. `Mod` is
     * Cmd on macOS and Ctrl elsewhere. `false` turns the shortcut off.
     */
    hotkey?: string | false;
  };
  /**
   * Turn one Pangular plugin off, by its id, or only its agent tools or its
   * actions: `{ travel: false }` or `{ travel: { actions: false } }`.
   * `inspectors.plugins: false` turns every plugin off.
   */
  plugins?: Record<string, boolean | PluginSwitchInput>;
}

/** What a `plugins` entry can turn off; each is on when left out. */
export interface PluginSwitchInput {
  enabled?: boolean;
  /** The plugin's agent tools. */
  tools?: boolean;
  /** The plugin's actions: page actions run from the panel and its action agent tools. */
  actions?: boolean;
}

/** One plugin's switches after the inspector, agent and action switches apply. */
export interface PluginSwitches {
  enabled: boolean;
  tools: boolean;
  actions: boolean;
}

/** A plugin id: lowercase letters, digits and dashes, starting with a letter. */
export const PLUGIN_ID = /^[a-z][a-z0-9-]{0,39}$/;

export interface ResolvedPangularConfig {
  inspectors: Record<PangularInspector, boolean>;
  agent: { readOnly: boolean; tools: Record<PangularInspector, boolean>; browserTools: boolean };
  actions: Record<PangularAction, boolean>;
  redaction: { secretNames: string[]; unmask: string[] };
  limits: Record<PangularLimit, number>;
  popup: { hotkey: string | false };
  /** The `plugins` entries that were given, by plugin id. */
  plugins: Record<string, PluginSwitches>;
}

/** The switches of one plugin under `config`, whether or not it has a `plugins` entry. */
export function pluginSwitches(id: string, config: ResolvedPangularConfig): PluginSwitches {
  const own = config.plugins?.[id];
  const enabled = config.inspectors.plugins && PLUGIN_ID.test(id) && (own?.enabled ?? true);
  return {
    enabled,
    tools: enabled && config.agent.tools.plugins && (own?.tools ?? true),
    actions: enabled && config.actions.plugins && (own?.actions ?? true),
  };
}

export const PANGULAR_CONFIG_KEY = 'pangular';

/** The popup shortcut when `popup.hotkey` is left out. */
export const DEFAULT_POPUP_HOTKEY = 'Alt+Shift+P';

const HOTKEY_MODIFIERS: Record<string, 'Mod' | 'Ctrl' | 'Meta' | 'Alt' | 'Shift'> = {
  mod: 'Mod',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
};

const MODIFIER_ORDER = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'] as const;

/**
 * A shortcut like `alt+shift+p` in its canonical spelling, `Alt+Shift+P`, or
 * `undefined` when it is not one: it needs one letter, digit or F1 to F12 key
 * and at least one modifier other than Shift, so typing never triggers it.
 */
export function normalizeHotkey(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 40) return undefined;
  const parts = value.split('+').map((part) => part.trim());
  if (parts.some((part) => !part)) return undefined;
  const modifiers = new Set<string>();
  let key: string | undefined;
  for (const part of parts) {
    const modifier = HOTKEY_MODIFIERS[part.toLowerCase()];
    if (modifier) {
      if (modifiers.has(modifier)) return undefined;
      modifiers.add(modifier);
      continue;
    }
    if (key !== undefined) return undefined;
    if (/^[a-z0-9]$/i.test(part)) key = part.toUpperCase();
    else if (/^f([1-9]|1[0-2])$/i.test(part)) key = part.toUpperCase();
    else return undefined;
  }
  if (!key || ![...modifiers].some((modifier) => modifier !== 'Shift')) return undefined;
  if (modifiers.has('Mod') && (modifiers.has('Ctrl') || modifiers.has('Meta'))) return undefined;
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
}

/** The key fields of a `KeyboardEvent` that a shortcut reads. */
export interface HotkeyEvent {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Whether a key press is `hotkey` (a `normalizeHotkey` result). Letters and
 * digits match by key position, so Alt and Option combinations that type
 * another character still match. `mac` decides what `Mod` means.
 */
export function matchesHotkey(event: HotkeyEvent, hotkey: string, mac: boolean): boolean {
  const parts = hotkey.split('+');
  const key = parts.pop()!;
  const wants = new Set(parts);
  const ctrl = wants.has('Ctrl') || (wants.has('Mod') && !mac);
  const meta = wants.has('Meta') || (wants.has('Mod') && mac);
  if (event.ctrlKey !== ctrl || event.metaKey !== meta) return false;
  if (event.altKey !== wants.has('Alt') || event.shiftKey !== wants.has('Shift')) return false;
  if (/^F\d+$/.test(key)) return event.key.toUpperCase() === key;
  const code = /^\d$/.test(key) ? `Digit${key}` : `Key${key}`;
  if (event.code) return event.code === code;
  return event.key.toUpperCase() === key;
}

/** A shortcut as the platform writes it: `⌥⇧P` on macOS, `Alt+Shift+P` elsewhere. */
export function hotkeyLabel(hotkey: string, mac: boolean): string {
  if (!mac) return hotkey.replace(/^Mod\b/, 'Ctrl');
  const symbols: Record<string, string> = {
    Mod: '⌘',
    Meta: '⌘',
    Ctrl: '⌃',
    Alt: '⌥',
    Shift: '⇧',
  };
  return hotkey
    .split('+')
    .map((part) => symbols[part] ?? part)
    .join('');
}

/**
 * The panel's tabs in their default order, with the inspector that turns
 * each one on. The panel builds its tab bar from it, and the hub's command
 * palette and the `open-in-panel` agent tool read it too.
 */
export const PANEL_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'audit', label: 'Audit' },
  { id: 'analog', label: 'Analog', inspector: 'analog' },
  { id: 'components', label: 'Components', inspector: 'components' },
  { id: 'routes', label: 'Routes', inspector: 'router' },
  { id: 'signals', label: 'Signals', inspector: 'signals' },
  { id: 'injectors', label: 'Injectors', inspector: 'injectors' },
  { id: 'store', label: 'Store', inspector: 'ngrx' },
  { id: 'queries', label: 'Queries', inspector: 'tanstackQuery' },
  { id: 'forms', label: 'Forms', inspector: 'forms' },
  { id: 'pipes', label: 'Pipes', inspector: 'pipes' },
  { id: 'network', label: 'SSR & HTTP', inspector: 'http' },
  { id: 'errors', label: 'Errors', inspector: 'errors' },
  { id: 'capacitor', label: 'Capacitor', inspector: 'capacitor' },
  { id: 'plugins', label: 'Plugins', inspector: 'plugins' },
] as const satisfies readonly { id: string; label: string; inspector?: PangularInspector }[];

export type PanelTab = (typeof PANEL_TABS)[number]['id'];

/**
 * Navigations a destroyed component has to outlive, along with
 * {@link RETAINED_AFTER_MS}, before the leak views call it still retained. The
 * garbage collector runs when it likes, so an instance still there right
 * after one navigation says little. The panel and `find-leaks` share these.
 */
export const RETAINED_AFTER_NAVIGATIONS = 2;
/** Time a destroyed component has to outlive before it counts as still retained. */
export const RETAINED_AFTER_MS = 10_000;

/** The panel tabs whose inspector is on under `config`. */
export function enabledPanelTabs(config: ResolvedPangularConfig): (typeof PANEL_TABS)[number][] {
  return PANEL_TABS.filter((tab) => !('inspector' in tab) || config.inspectors[tab.inspector]);
}

/**
 * The tabs where a deep link's `id` selects an item, and what it names
 * there. On other tabs the link opens the tab only.
 */
export const PANEL_LINK_ITEMS: Partial<Record<PanelTab, string>> = {
  components: 'a component instance, by its id in the component tree',
  injectors: "a component's element injector, by the component's id",
  forms: 'a form, by its id',
};

/** Where a deep link into the panel points: a tab, and an item on one page. */
export interface PanelLink {
  tab: string;
  /** The item to select, as `PANEL_LINK_ITEMS` describes. */
  id?: string;
  /** The page the item belongs to (a `pageId`). */
  page?: string;
}

const MAX_LINK_PART = 200;

/** The hash of a deep link, such as `#tab=components&id=12&page=k3x9`. */
export function panelLinkHash(link: PanelLink): string {
  const params = new URLSearchParams({ tab: link.tab });
  if (link.id) params.set('id', link.id);
  if (link.page) params.set('page', link.page);
  return `#${params.toString()}`;
}

/** Reads a deep link from a URL hash; `null` without a `tab`. Over-long parts are dropped. */
export function parsePanelLink(hash: string): PanelLink | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const part = (name: string) => {
    const value = params.get(name)?.trim();
    return value && value.length <= MAX_LINK_PART ? value : undefined;
  };
  const tab = part('tab');
  if (!tab) return null;
  const id = part('id');
  const page = part('page');
  return { tab, ...(id ? { id } : {}), ...(page ? { page } : {}) };
}

/** Where a panel command shows in a palette. */
export type PanelCommandGroup = 'Go to' | 'Actions' | 'Theme' | 'Popup';

/** A command the panel runs, from its own palette or the hub's. */
export interface PanelCommand {
  /** Without the `pangular:` prefix the hub adds, such as `tab:signals`. */
  id: string;
  title: string;
  group: PanelCommandGroup;
  /** Extra words the palette filter matches. */
  keywords?: string;
  /**
   * Only the popup has dock modes and a pop-out window, so the hub leaves
   * these out. `popout:return` shows in the pop-out window instead.
   */
  popupOnly?: boolean;
}

const PANEL_ACTIONS: (PanelCommand & { inspector?: PangularInspector })[] = [
  { id: 'settings', title: 'Open settings', group: 'Go to', keywords: 'preferences tabs' },
  {
    id: 'pick-component',
    title: 'Pick component on page',
    group: 'Actions',
    keywords: 'select inspect element',
    inspector: 'components',
  },
  {
    id: 'cd-record-start',
    title: 'Start recording change detection',
    group: 'Actions',
    keywords: 'profiler cycles',
    inspector: 'components',
  },
  {
    id: 'cd-record-stop',
    title: 'Stop recording change detection',
    group: 'Actions',
    keywords: 'profiler cycles',
    inspector: 'components',
  },
  {
    id: 'cd-clear',
    title: 'Clear change detection recording',
    group: 'Actions',
    keywords: 'reset recordings cycles',
    inspector: 'components',
  },
  { id: 'theme:system', title: 'Theme: follow the system', group: 'Theme', keywords: 'auto' },
  { id: 'theme:light', title: 'Theme: light', group: 'Theme' },
  { id: 'theme:dark', title: 'Theme: dark', group: 'Theme' },
  { id: 'dock:float', title: 'Popup: float', group: 'Popup', keywords: 'dock', popupOnly: true },
  {
    id: 'dock:bottom',
    title: 'Popup: dock to the bottom',
    group: 'Popup',
    keywords: 'dock',
    popupOnly: true,
  },
  {
    id: 'dock:right',
    title: 'Popup: dock to the right',
    group: 'Popup',
    keywords: 'dock',
    popupOnly: true,
  },
  {
    id: 'dock:reset-size',
    title: 'Popup: reset the docked size',
    group: 'Popup',
    keywords: 'splitter resize height width',
    popupOnly: true,
  },
  {
    id: 'popout',
    title: 'Popup: open in its own window',
    group: 'Popup',
    keywords: 'pop out detach new window',
    popupOnly: true,
  },
  {
    id: 'popout:return',
    title: 'Popup: back into the page',
    group: 'Popup',
    keywords: 'pop in attach dock window',
    popupOnly: true,
  },
];

/** Every panel command under `config`: one per enabled tab, then the actions. */
export function panelCommands(config: ResolvedPangularConfig): PanelCommand[] {
  const tabs: PanelCommand[] = enabledPanelTabs(config).map((tab) => ({
    id: `tab:${tab.id}`,
    title: `Go to ${tab.label}`,
    group: 'Go to',
    keywords: 'tab open',
  }));
  const actions = PANEL_ACTIONS.filter(
    (command) => !command.inspector || config.inspectors[command.inspector],
  ).map(({ inspector: _inspector, ...command }) => command);
  return [...tabs, ...actions];
}

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
      browserTools: flag(agent['browserTools'], false),
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
    popup: { hotkey: popupHotkey(record(input['popup'])['hotkey']) },
    plugins: pluginEntries(input['plugins']),
  };
}

const MAX_PLUGIN_ENTRIES = 100;

function pluginEntries(value: unknown): Record<string, PluginSwitches> {
  const entries: Record<string, PluginSwitches> = {};
  for (const [id, entry] of Object.entries(record(value)).slice(0, MAX_PLUGIN_ENTRIES)) {
    if (!PLUGIN_ID.test(id)) continue;
    if (typeof entry === 'boolean') {
      entries[id] = { enabled: entry, tools: true, actions: true };
      continue;
    }
    const switches = record(entry);
    if (entry === undefined || !Object.keys(switches).length) continue;
    entries[id] = {
      enabled: flag(switches['enabled'], true),
      tools: flag(switches['tools'], true),
      actions: flag(switches['actions'], true),
    };
  }
  return entries;
}

function popupHotkey(value: unknown): string | false {
  if (value === false) return false;
  return normalizeHotkey(value) ?? DEFAULT_POPUP_HOTKEY;
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

const CONFIG_KEYS = [
  'inspectors',
  'agent',
  'actions',
  'redaction',
  'limits',
  'popup',
  'plugins',
] as const;

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
  const agent = object('agent', input['agent'], ['readOnly', 'tools', 'browserTools']);
  boolean('agent.readOnly', agent['readOnly'], 'off');
  boolean('agent.browserTools', agent['browserTools'], 'off');
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
  const popup = object('popup', input['popup'], ['hotkey']);
  const hotkey = popup['hotkey'];
  if (hotkey !== undefined && hotkey !== false && normalizeHotkey(hotkey) === undefined) {
    problems.push(
      typeof hotkey === 'string'
        ? `\`popup.hotkey\` is ${describe(hotkey)}, which is not a shortcut like \`Alt+Shift+P\`: one letter, digit or F1 to F12 key with Mod, Ctrl, Meta or Alt. It was ignored, so it is ${DEFAULT_POPUP_HOTKEY}.`
        : `\`popup.hotkey\` should be a shortcut string or false, got ${describe(hotkey)}. It was ignored, so it is ${DEFAULT_POPUP_HOTKEY}.`,
    );
  }
  const plugins = input['plugins'];
  if (plugins !== undefined && !isRecord(plugins)) {
    problems.push(`\`plugins\` should be an object, got ${describe(plugins)}. It was ignored.`);
  } else if (plugins) {
    for (const [id, entry] of Object.entries(plugins)) {
      if (!PLUGIN_ID.test(id)) {
        problems.push(
          `\`plugins.${id}\` is not a plugin id (lowercase letters, digits and dashes, starting with a letter). It was ignored.`,
        );
        continue;
      }
      if (typeof entry === 'boolean') continue;
      if (!isRecord(entry)) {
        problems.push(
          `\`plugins.${id}\` should be true, false or an object, got ${describe(entry)}. It was ignored.`,
        );
        continue;
      }
      booleans(`plugins.${id}`, entry, ['enabled', 'tools', 'actions'], 'on');
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
  const { inspectors, agent, actions, redaction, limits, popup, plugins, ...rest } = options;
  return { config: { inspectors, agent, actions, redaction, limits, popup, plugins }, rest };
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
  ngrx: ['dispatch-ngrx-action', 'restore-ngrx-state'],
  http: [
    'set-http-rule',
    'remove-http-rule',
    'set-ssr-override',
    'remove-ssr-override',
    'clear-recordings',
  ],
  analog: ['analog-call-api', 'clear-recordings'],
  components: ['set-component-property', 'set-signal'],
  tanstackQuery: ['query-action'],
  // Plugin tools are checked by `pluginToolAllowed`: their names come from the plugins.
  plugins: [],
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
  'restore-ngrx-state': 'action',
  'set-http-rule': 'action',
  'remove-http-rule': 'action',
  'set-ssr-override': 'action',
  'remove-ssr-override': 'action',
  'record-pipes': 'action',
  'track-subscriptions': 'action',
  'watch-signal': 'action',
  'change-detection': 'action',
  hydration: 'action',
  'clear-recordings': 'destructive',
  'analog-call-api': 'destructive',
  'set-component-property': 'action',
  'set-signal': 'action',
  'query-action': 'action',
  // Only with `axe`, which loads and runs axe-core in the page.
  audit: 'action',
};

/**
 * Tools that `agent.readOnly` keeps as `read` tools, with the arguments that
 * act refused: `change-detection` still answers, but without `record`,
 * `hydration` without `overlay`, and `audit` without `axe`.
 */
export const READ_ONLY_VARIANTS: readonly string[] = ['change-detection', 'hydration', 'audit'];

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
    http: 'Changing HTTP mock rules and SSR overrides, and clearing HTTP calls',
    analog: 'Calling API routes and clearing server calls',
    components: 'Editing component properties and signals',
    tanstackQuery: 'Invalidating and refetching TanStack queries',
    plugins: 'Running plugin actions',
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
  // Each page's Angular version and debug API parts, read by every view.
  'report-page-angular',
  'forget-page-angular',
  // The activity lease: pages ask whether a panel or an agent watches.
  'page-interest',
  'list-pages',
  // Opens any tab, so it stays with every inspector off; it lists only the tabs that are on.
  'open-in-panel',
  // The page registers the `read` agent tools for browser agents (agent.browserTools).
  'list-browser-tools',
  'call-browser-tool',
  'open-in-editor',
  'hub-dock-seen',
  // Store as global spans the components, injectors and NgRx inspectors; the
  // handler checks that the inspector of each request is on.
  'request-console-global',
  'console-global-result',
  // The audit reads every inspector that is on (and, for agents, whose agent
  // tools are on), so it stays with any of them; the axe pass belongs to none.
  'audit',
  'get-audit',
  'audit-session',
  'request-axe-run',
  'axe-result',
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
  'component-screenshot-result': 'components',
  'request-component-edit': 'components',
  'component-edit-result': 'components',
  'request-hydration-overlay': 'components',
  'request-component-value': 'components',
  'component-value-result': 'components',
  'push-leaks': 'components',
  'forget-leaks-page': 'components',
  'request-leak-tracking': 'components',
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
  'explain-injection': 'injectors',
  'push-startup': 'injectors',
  'forget-startup-page': 'injectors',
  'get-ngrx-store': 'ngrx',
  'push-ngrx-state': 'ngrx',
  'forget-ngrx-page': 'ngrx',
  'ngrx-action-result': 'ngrx',
  'request-ngrx-action': 'ngrx',
  'request-ngrx-history': 'ngrx',
  'import-ngrx-session': 'ngrx',
  'request-provider-value': 'injectors',
  'provider-value-result': 'injectors',
  'push-redux-stores': 'ngrx',
  'forget-redux-stores-page': 'ngrx',
  'push-tanstack-query': 'tanstackQuery',
  'forget-tanstack-query-page': 'tanstackQuery',
  'request-tanstack-query': 'tanstackQuery',
  'tanstack-query-result': 'tanstackQuery',
  'push-forms': 'forms',
  'ping-forms': 'forms',
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
  'push-errors': 'errors',
  'forget-errors-page': 'errors',
  'push-analog': 'analog',
  'forget-analog-page': 'analog',
  'analog-clear-calls': 'analog',
  'analog-project': 'analog',
  'analog-explain-url': 'analog',
  'analog-lint': 'analog',
  'analog-render': 'analog',
  'analog-text': 'analog',
  'analog-call-api': 'analog',
  'push-plugins': 'plugins',
  'forget-plugins-page': 'plugins',
  'request-plugin-action': 'plugins',
  'plugin-action-result': 'plugins',
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
  hydration: 'components',
  'change-detection': 'components',
  'diagnose-change-detection': 'components',
  'set-component-property': 'components',
  'set-signal': 'components',
  'find-leaks': 'components',
  'track-subscriptions': 'components',
  'screenshot-component': 'components',
  'signal-graph': 'signals',
  'inspect-signals': 'signals',
  'watch-signal': 'signals',
  'injector-tree': 'injectors',
  'inspect-providers': 'injectors',
  'explain-injection': 'injectors',
  'read-provider-value': 'injectors',
  'startup-timing': 'injectors',
  'ngrx-store': 'ngrx',
  'dispatch-ngrx-action': 'ngrx',
  'inspect-signal-store': 'ngrx',
  'signal-store-history': 'ngrx',
  'inspect-ngrx-entry': 'ngrx',
  'export-ngrx-session': 'ngrx',
  'import-ngrx-session': 'ngrx',
  'generate-ngrx-test': 'ngrx',
  'restore-ngrx-state': 'ngrx',
  'inspect-redux-stores': 'ngrx',
  'list-queries': 'tanstackQuery',
  'inspect-query': 'tanstackQuery',
  'query-action': 'tanstackQuery',
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
  'http-waterfall': 'http',
  'list-http-rules': 'http',
  'set-http-rule': 'http',
  'remove-http-rule': 'http',
  'inspect-transfer-state': 'http',
  'list-ssr-overrides': 'http',
  'set-ssr-override': 'http',
  'remove-ssr-override': 'http',
  'clear-recordings': 'http',
  'list-capacitor-calls': 'capacitor',
  'list-capacitor-plugins': 'capacitor',
  'list-errors': 'errors',
  'explain-error': 'errors',
  'list-console': 'errors',
  'list-plugins': 'plugins',
  'inspect-plugin': 'plugins',
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
  leaks: 'components',
  'signal-graph': 'signals',
  'injector-tree': 'injectors',
  'ngrx-store': 'ngrx',
  'redux-stores': 'ngrx',
  'tanstack-query': 'tanstackQuery',
  forms: 'forms',
  router: 'router',
  routes: 'router',
  'pipe-usage': 'pipes',
  http: 'http',
  'http-payloads': 'http',
  capacitor: 'capacitor',
  analog: 'analog',
  errors: 'errors',
  startup: 'injectors',
  plugins: 'plugins',
};

/** Shared-state keys that belong to no inspector, without the `pangular:` prefix. */
export const SHARED_STATE_KEYS: readonly string[] = ['page-visibility', 'page-angular', 'audit'];

/**
 * Whether MCP clients may read a shared-state key. A `pangular:` key in
 * neither list stays hidden, so a new key needs an entry before agents see it.
 * Keys of the hub and of other devframes are left to them.
 */
export function sharedStateExposed(key: string, config: ResolvedPangularConfig): boolean {
  if (!key.startsWith('pangular:')) return true;
  const name = agentName(key);
  if (SHARED_STATE_KEYS.includes(name)) return true;
  // Every page plugin's view, in one key: shown only while no plugin has its
  // tools turned off, since a key can't be filtered per plugin.
  if (name === 'plugins' && config.agent.tools.plugins) {
    return Object.keys(config.plugins ?? {}).every((id) => pluginSwitches(id, config).tools);
  }
  // A server plugin's own state, `plugin.<id>`.
  const plugin = /^plugin\.(.+)$/.exec(name)?.[1];
  if (plugin !== undefined) return pluginSwitches(plugin, config).tools;
  const inspector = SHARED_STATE_INSPECTOR[name];
  return inspector !== undefined && config.agent.tools[inspector];
}

/**
 * Agent tools and resources that answer only while a page reports to the
 * server, that call the app's dev server, or that point into the panel the
 * server serves. The stdio MCP server has none of these.
 */
export const PAGE_AGENT_ENTRIES: readonly string[] = [
  'list-pages',
  'open-in-panel',
  'clear-recordings',
  'component-tree',
  'highlight',
  'inspect-component',
  'list-components',
  'defer-blocks',
  'for-blocks',
  'hydration',
  'change-detection',
  'diagnose-change-detection',
  'set-component-property',
  'set-signal',
  'find-leaks',
  'track-subscriptions',
  'screenshot-component',
  'signal-graph',
  'inspect-signals',
  'watch-signal',
  'injector-tree',
  'inspect-providers',
  'explain-injection',
  'read-provider-value',
  'startup-timing',
  'ngrx-store',
  'dispatch-ngrx-action',
  'inspect-signal-store',
  'signal-store-history',
  'export-ngrx-session',
  'restore-ngrx-state',
  'inspect-redux-stores',
  'list-queries',
  'inspect-query',
  'query-action',
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
  'http-waterfall',
  'list-http-rules',
  'set-http-rule',
  'remove-http-rule',
  'inspect-transfer-state',
  'list-ssr-overrides',
  'set-ssr-override',
  'remove-ssr-override',
  'list-capacitor-calls',
  'list-capacitor-plugins',
  'list-errors',
  'explain-error',
  'list-console',
  'list-plugins',
  'inspect-plugin',
  'audit',
];

export function isPageAgentEntry(id: string): boolean {
  return PAGE_AGENT_ENTRIES.includes(agentName(id));
}

function agentName(id: string): string {
  return id.replace(/^pangular:/, '');
}

/** A plugin agent tool's name within its plugin, like a plugin id. */
export const PLUGIN_TOOL_NAME = PLUGIN_ID;

/**
 * The id of a plugin's agent tool: `pangular:plugin:<plugin>:<tool>`, which
 * MCP clients call as `pangular_plugin_<plugin>_<tool>`. Built-in tools never
 * start with `plugin`, so a plugin can't shadow one.
 */
export function pluginToolId(pluginId: string, name: string): string {
  return `pangular:plugin:${pluginId}:${name}`;
}

/** The name MCP clients call a plugin tool by. */
export function pluginMcpName(pluginId: string, name: string): string {
  return `pangular_plugin_${pluginId}_${name}`;
}

/** MCP clients refuse tool names longer than this. */
export const MAX_MCP_TOOL_NAME = 64;

/** How long a page action may run by default, on the page and on the server. */
export const PLUGIN_ACTION_TIMEOUT_MS = 10_000;
/** The longest a page action may be given. */
export const MAX_PLUGIN_ACTION_TIMEOUT_MS = 30_000;

/**
 * Whether a plugin's agent tool is registered under `config`: its plugin and
 * the plugin's tools are on, and a tool that is not `read` also needs actions
 * on for the plugin and `agent.readOnly` off.
 */
export function pluginToolAllowed(
  pluginId: string,
  safety: AgentSafety,
  config: ResolvedPangularConfig,
): boolean {
  const switches = pluginSwitches(pluginId, config);
  if (!switches.tools) return false;
  return safety === 'read' || (!config.agent.readOnly && switches.actions);
}

/** The inspector an agent tool or resource belongs to; `undefined` for shared ones. */
export function agentInspector(id: string): PangularInspector | undefined {
  const name = agentName(id);
  if (name.startsWith('plugin:')) return 'plugins';
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
  tanstackQuery: 'TanStack Query',
  forms: 'Forms',
  router: 'Router',
  pipes: 'Pipes',
  http: 'HTTP',
  analog: 'Analog',
  capacitor: 'Capacitor',
  errors: 'Errors',
  plugins: 'Plugins',
};

const ACTION_LABEL: Record<PangularAction, string> = {
  forms: 'Form writes',
  router: 'Navigation',
  ngrx: 'NgRx restore and dispatch',
  http: 'HTTP mocking',
  analog: 'Analog API calls',
  components: 'Component edits',
  tanstackQuery: 'TanStack Query invalidate and refetch',
  plugins: 'Plugin actions',
};

const LIMIT_LABEL: Record<PangularLimit, (value: number) => string> = {
  refreshMs: (value) => `poll every ${value} ms`,
  navigations: (value) => `${value} navigations`,
  formTimeline: (value) => `${value} form events`,
  httpCalls: (value) => `${value} HTTP calls`,
  changeLog: (value) => `${value} NgRx changes`,
  cdCycles: (value) => `${value} change detection cycles`,
  capacitorCalls: (value) => `${value} Capacitor plugin calls`,
  idleAfterMs: (value) =>
    value ? `idle ${value / 1000} s after the last agent call` : 'never idle',
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
  if (config.popup.hotkey !== DEFAULT_POPUP_HOTKEY) {
    add('Popup shortcut', [config.popup.hotkey === false ? 'Off' : config.popup.hotkey]);
  }
  const plugins = Object.entries(config.plugins ?? {});
  add(
    'Plugins off',
    plugins.filter(([, entry]) => !entry.enabled).map(([id]) => id),
  );
  add(
    'Plugin tools or actions off',
    plugins
      .filter(([, entry]) => entry.enabled && (!entry.tools || !entry.actions))
      .map(
        ([id, entry]) =>
          `${id} (${[!entry.tools && 'tools', !entry.actions && 'actions'].filter(Boolean).join(', ')})`,
      ),
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
  /** What started the cycle, from the recording's trigger attribution (`cd-diagnosis.ts`). */
  cause?: CdCause;
  /** Component checks where Angular ran the template, the dev-mode checkNoChanges pass left out. */
  refreshed?: number;
  /** Refreshed checks where nothing the component renders changed. */
  unchanged?: number;
}

/**
 * What started a change detection cycle:
 * - `event`: a template listener (DOM event or output), or a DOM event handler that notified Angular.
 * - `http`: code that ran on an HTTP response.
 * - `timer`: code that ran in a timer, as zone.js reports it.
 * - `signal`: a signal write that marked a template for check.
 * - `effect`: a signal write that scheduled an effect.
 * - `markForCheck`: `ChangeDetectorRef.markForCheck()`, such as the async pipe.
 * - `input`: `ComponentRef.setInput()`.
 * - `view`: a view attached or detached, a defer block, an afterRender registration or animations.
 * - `tick`: app code called `ApplicationRef.tick()`.
 * - `zone`: zone.js ran the tick and nothing notified Angular before it, so only zone.js picked the change up.
 * - `unknown`: Angular's scheduler ran a tick the recording saw no notification for.
 */
export type CdCauseKind =
  | 'event'
  | 'http'
  | 'timer'
  | 'signal'
  | 'effect'
  | 'markForCheck'
  | 'input'
  | 'view'
  | 'tick'
  | 'zone'
  | 'unknown';

/** What started one cycle. The text form is `cdCauseText` in `cd-data.ts`. */
export interface CdCause {
  kind: CdCauseKind;
  /** For `http`, `timer` and an `event` outside a template listener: how the code told Angular. */
  via?: CdCauseKind;
  /** The component class: the listener's owner for an event, else the class of the first app frame. */
  component?: string;
  /** The template listener's function name. */
  listener?: string;
  /** The DOM event type, such as `click`. */
  event?: string;
  /** The event target's tag, such as `button`. */
  target?: string;
  /** The `debugName` of the signal written, `?` for an unnamed one. */
  signal?: string;
  /** The zone.js task the code ran in, such as `setTimeout` or `XMLHttpRequest.send`. */
  task?: string;
  /** True when zone.js (`NgZone`) ran the tick rather than Angular's zoneless scheduler. */
  zone?: boolean;
  /** The first app frames of the code that notified Angular or called `tick()`. */
  stack?: string[];
  /** More notifications that came before the same tick. */
  more?: number;
}

/** Refreshed and unchanged checks of one component class over a recording. */
export interface CdWasteStat {
  name: string;
  /** Checks where Angular ran the component's template. */
  refreshed: number;
  /** Refreshed checks where nothing it renders changed: no DOM update and no new input reference for a child. */
  unchanged: number;
  /** The class's change detection strategy, from `ng.getDirectiveMetadata`. */
  strategy?: 'OnPush' | 'Eager';
}

/** One input of one component class that broke OnPush during a recording. */
export interface CdInputStat {
  /** The component class that declares the input. */
  name: string;
  input: string;
  /** The component class whose template set it, when the recording saw it. */
  parent?: string;
  /** Checks where the input kept its reference but its contents changed (mutated in place). */
  inPlace: number;
  /** Checks where the input got a new reference with the same contents. */
  sameContents: number;
}

/** A component class that changed only in ticks zone.js started with no Angular notification. */
export interface CdZoneStat {
  name: string;
  /** Zone-only ticks in which it changed. */
  ticks: number;
  /** The zone.js tasks behind those ticks, at most 3, such as `setTimeout`. */
  tasks?: string[];
}

/** Trigger attribution and wasted checks over a recording. */
export interface CdDiagnosis {
  /** Whether the page found Angular's change detection scheduler, so cycles carry a cause. */
  triggers: boolean;
  /** Whether the page could watch DOM updates, so unchanged checks are counted. */
  waste: boolean;
  /** The page's Angular major version, for the OnPush hint. */
  major?: number;
  /** Cycles per cause kind. */
  causes: Partial<Record<CdCauseKind, number>>;
  /** Component classes by unchanged checks, at most 100. */
  components: CdWasteStat[];
  /** Inputs mutated in place or given equal new references, at most 50. */
  inputs?: CdInputStat[];
  /** Components that changed only in zone.js ticks, at most 50. */
  zone?: CdZoneStat[];
  /** Whether the page loads zone.js (a `Zone` global); missing in recordings made before it was reported. */
  zoneJs?: boolean;
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
  /** Trigger attribution, wasted checks and OnPush hints, on pages that record them. */
  diagnosis?: CdDiagnosis;
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

/**
 * A component tree search, as the panel's filter and the list-components tool
 * read it: `<tag>` tokens match a host tag, `[dir]` tokens match a directive
 * on the host by selector attribute or class name, and the rest is plain text
 * found in a class name, tag or directive. Every part must match. A token
 * still being typed (`<but`, `[mat`) matches as a prefix or part of a name.
 */
export interface TreeQuery {
  tags: { value: string; exact: boolean }[];
  directives: { value: string; exact: boolean }[];
  text: string;
}

/** The node fields a tree search reads. */
export interface TreeQueryNode {
  name: string;
  tag: string;
  directives?: string[];
  attributes?: string[];
}

export function parseTreeQuery(query: string): TreeQuery {
  const parsed: TreeQuery = { tags: [], directives: [], text: '' };
  let rest = query.toLowerCase();
  rest = rest.replace(/<\s*([^<>\s]+)\s*>/g, (_, tag: string) => {
    parsed.tags.push({ value: tag, exact: true });
    return ' ';
  });
  rest = rest.replace(/\[\s*([^[\]\s]+)\s*\]/g, (_, dir: string) => {
    parsed.directives.push({ value: dir, exact: true });
    return ' ';
  });
  // A token still being typed at the end of the query.
  rest = rest.replace(/(^|\s)([<[])([^<>[\]\s]*)$/, (_, space: string, open: string, value) => {
    if (value) (open === '<' ? parsed.tags : parsed.directives).push({ value, exact: false });
    return space;
  });
  parsed.text = rest.replace(/\s+/g, ' ').trim();
  return parsed;
}

export function isEmptyTreeQuery(query: TreeQuery): boolean {
  return !query.tags.length && !query.directives.length && !query.text;
}

/** Whether a tree node matches every part of a parsed search. */
export function matchesTreeQuery(node: TreeQueryNode, query: TreeQuery): boolean {
  const tag = node.tag.toLowerCase();
  const classes = (node.directives ?? []).map((name) => name.toLowerCase());
  const attributes = (node.attributes ?? []).map((name) => name.toLowerCase());
  const names = [
    ...classes,
    ...classes.map((name) => name.replace(/directive$/, '')),
    ...attributes,
  ];
  for (const { value, exact } of query.tags) {
    if (exact ? tag !== value : !tag.startsWith(value)) return false;
  }
  for (const { value, exact } of query.directives) {
    if (!names.some((name) => (exact ? name === value : name.includes(value)))) return false;
  }
  if (query.text) {
    const text = query.text;
    const hit =
      node.name.toLowerCase().includes(text) ||
      tag.includes(text) ||
      classes.some((name) => name.includes(text)) ||
      attributes.some((name) => name.includes(text));
    if (!hit) return false;
  }
  return true;
}

// --- Angular versions ---
// What each inspector needs from Angular's debug API, shared by the overlay,
// the agent tools and the panel so they all name the same version.
// `docs/angular-compat.md` lists where each version comes from.
/**
 * A part of Angular's debug API that some inspector needs. The overlay finds
 * each one on the page at runtime (`ng-capabilities.ts`).
 */
export type AngularCapability =
  /** `ng.getComponent`, `getDirectives`, `getInjector`, `getHostElement`: Ivy development builds, Angular 12+. */
  | 'debugApi'
  /** `ng.ɵgetInjectorProviders`, `ɵgetInjectorResolutionPath`, `ɵgetDependenciesFromInjectable`: 16.2+. */
  | 'injectorProviders'
  /** `ng.ɵgetInjectorMetadata`: 17.0+. */
  | 'injectorMetadata'
  /** `ng.isSignal`: 17.1+. */
  | 'isSignal'
  /** `ng.ɵgetSignalGraph`: 19.1+, with node ids from 20.1. */
  | 'signalGraph'
  /** `ng.ɵgetDeferBlocks` (19.1 to 21.x) or `ng.ɵgetControlFlowBlocks` (22.0+). */
  | 'deferBlocks'
  /** `ng.ɵgetControlFlowBlocks`: 22.0+. */
  | 'forBlocks'
  /** `ng.ɵsetProfiler` that adds a profiler and hands back its remover: 20.0+. */
  | 'profiler'
  /** `ng.enableProfiling`: 20.0+. */
  | 'angularProfiling'
  /** `ng.ɵgetRouterInstance`, published by `provideRouter()`: 20.3.5+. */
  | 'routerInstance';

export const ANGULAR_CAPABILITIES: readonly AngularCapability[] = [
  'debugApi',
  'injectorProviders',
  'injectorMetadata',
  'isSignal',
  'signalGraph',
  'deferBlocks',
  'forBlocks',
  'profiler',
  'angularProfiling',
  'routerInstance',
];

/** The Angular a page runs and the debug API parts it has, as the overlay reports them. */
export interface AngularPageInfo {
  /** The `ng-version` attribute of the first Angular root, such as `15.2.10`. */
  version?: string;
  /** Each capability the overlay checked, `true` when the page has it. */
  capabilities: Partial<Record<AngularCapability, boolean>>;
}

interface FeatureNeed {
  /** What needs it, as the subject of "… needs Angular X or later". */
  subject: string;
  /** The first Angular version where it works, `major.minor`. */
  since: string;
}

/**
 * The first version each capability works in, and how the panel and the
 * agent tools name what is missing without it.
 */
export const ANGULAR_FEATURE_NEEDS: Record<AngularCapability, FeatureNeed> = {
  debugApi: { subject: 'Live data', since: '12.0' },
  injectorProviders: { subject: 'Reading providers and environment injectors', since: '16.2' },
  injectorMetadata: { subject: 'The full injector tree', since: '17.0' },
  isSignal: { subject: 'Telling signals apart in component values', since: '17.1' },
  // `ɵgetSignalGraph` exists from 19.1, but its nodes carry ids only from 20.1.
  signalGraph: { subject: 'The live signal graph', since: '20.1' },
  deferBlocks: { subject: 'Listing @defer blocks', since: '19.1' },
  forBlocks: { subject: 'Listing @for blocks', since: '22.0' },
  profiler: { subject: 'Recording change detection', since: '20.0' },
  angularProfiling: { subject: 'Angular profiling', since: '20.0' },
  routerInstance: { subject: 'The router debug util', since: '20.3' },
};

/** `15.2.10` as `15.2`; anything that is not a version as it is. */
export function shortAngularVersion(version: string): string {
  const match = /^(\d+)\.(\d+)/.exec(version.trim());
  return match ? `${match[1]}.${match[2]}` : version.trim();
}

function versionParts(version: string): [number, number] | null {
  const match = /^(\d+)(?:\.(\d+))?/.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2] ?? 0)] : null;
}

/** Whether `version` is at least `since` (both `major.minor`, patch ignored). */
export function angularVersionAtLeast(version: string, since: string): boolean {
  const have = versionParts(version);
  const want = versionParts(since);
  if (!have || !want) return false;
  return have[0] !== want[0] ? have[0] > want[0] : have[1] >= want[1];
}

/**
 * Whether the page lacks `capability`. A page that never reported its
 * capabilities (an older overlay, a native platform) is not marked as lacking it.
 */
export function lacksCapability(
  info: AngularPageInfo | null | undefined,
  capability: AngularCapability,
): boolean {
  return info?.capabilities?.[capability] === false;
}

/**
 * One sentence that says what needs which Angular version and what the page
 * runs, such as "The live signal graph needs Angular 20.1 or later; this page
 * runs Angular 15.2." A page on a new enough version without the util runs a
 * production build, which leaves the debug API out.
 */
export function angularUnavailableText(
  capability: AngularCapability,
  version: string | undefined,
): string {
  const need = ANGULAR_FEATURE_NEEDS[capability];
  const head = `${need.subject} needs Angular ${need.since} or later`;
  if (!version) return `${head}; this page's Angular version is unknown.`;
  const runs = shortAngularVersion(version);
  if (angularVersionAtLeast(version, need.since)) {
    return `${head} in a development build; this page runs Angular ${runs} without it, which usually means a production build.`;
  }
  return `${head}; this page runs Angular ${runs}.`;
}
