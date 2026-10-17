import { AsyncLocalStorage } from 'node:async_hooks';
import { argsToJsonSchema, stringifyForMcp } from 'devframe/internal';
import { toAgentToolName } from 'devframe/utils/agent-tool-name';
import { redactJsonText } from '../json-text-redact.ts';
import { isSecretName, redactText } from '../serialize.ts';
import { setCallerPageReader } from './page-scope.ts';
import { ToolRefusal } from './refusal.ts';

/**
 * The `read` agent tools a page registers for browser agents (WebMCP and
 * Chrome DevTools for agents). The page lists them with `list-browser-tools`
 * and runs them with `call-browser-tool`, so each call goes through the same
 * handler, config checks and redaction as an MCP call.
 */

export const LIST_BROWSER_TOOLS = 'list-browser-tools';
export const CALL_BROWSER_TOOL = 'call-browser-tool';
/** The panel's Settings switch: turns the page tools on or off while the server runs. */
export const SET_BROWSER_TOOLS = 'set-browser-tools';
/** Broadcast to the pages after the switch changes, so they register or unregister. */
export const BROWSER_TOOLS_CHANGED = 'browser-tools-changed';
/** The shared-state key the panel reads the switch from. */
export const BROWSER_TOOLS_STATE = 'browser-tools';

/** What the panel shows: the switch, and where `agent.browserTools` started it. */
export interface BrowserToolsSwitchState {
  enabled: boolean;
  /** `agent.browserTools` from the devtools config, the value after a restart. */
  config: boolean;
}

export interface BrowserToolsSwitch {
  enabled(): boolean;
  state(): BrowserToolsSwitchState;
  /** Sets the switch from a panel message; refuses anything but a boolean `enabled`. */
  set(message: unknown): BrowserToolsSwitchState | { error: string };
}

/**
 * The page tools switch. `agent.browserTools` sets where it starts; the
 * panel's Settings changes it for every page until the server restarts.
 * `onChange` runs only when the value changes.
 */
export function createBrowserToolsSwitch(
  config: boolean,
  onChange: (state: BrowserToolsSwitchState) => void = () => {},
): BrowserToolsSwitch {
  let enabled = config;
  const state = () => ({ enabled, config });
  return {
    enabled: () => enabled,
    state,
    set(message) {
      const next = isRecord(message) ? message['enabled'] : undefined;
      if (typeof next !== 'boolean') return { error: 'Send {enabled: true} or {enabled: false}.' };
      if (next !== enabled) {
        enabled = next;
        onChange(state());
      }
      return state();
    },
  };
}

/** What the page registers: the MCP name, so a tool has one name everywhere. */
export interface BrowserTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface BrowserToolAnswer {
  text: string;
  isError?: boolean;
}

interface ListedTool {
  id: string;
  kind: 'rpc' | 'tool';
  title?: string;
  description: string;
  safety: 'read' | 'action' | 'destructive';
  rpcName?: string;
  args?: readonly unknown[];
  inputSchema?: unknown;
}

/** The parts of the devframe context the browser tools use. */
export interface BrowserToolHost {
  agent: {
    list(): { tools: readonly ListedTool[] };
    invoke(id: string, args: unknown): Promise<unknown>;
  };
  rpc: { definitions: { get(name: string): { args?: readonly unknown[] } | undefined } };
}

const MAX_TEXT = 100_000;

/** The calling page during a page tool call; tool answers read it through `callerPage()`. */
const callerScope = new AsyncLocalStorage<string>();
setCallerPageReader(() => callerScope.getStore());

/**
 * Page tools answer for the page that calls them, so a tool reaches the page
 * only when it is scoped to one page or reads the workspace source.
 *
 * - A tool with a `page` or `pageId` argument is listed, and the call always
 *   gets the calling page's id (see {@link scopedArgs}).
 * - A tool without one is listed only when it is in {@link SOURCE_TOOLS}:
 *   these read the workspace (source scans, build metadata), never a page.
 *   Any other tool without a page scope, such as `list-pages`,
 *   `list-ssr-requests`, `explain-ssr-request`, `list-ssr-overrides`,
 *   `list-http-rules` and `analog-server-calls`, answers about every tab or
 *   the whole server, so it stays MCP only. A new tool is left out until it
 *   is added here.
 * - {@link MCP_ONLY_TOOLS} are page scoped but stay off the page too.
 */
const SOURCE_TOOLS: ReadonlySet<string> = new Set([
  'pangular:get-routes',
  'pangular:get-components',
  'pangular:get-pipes',
  'pangular:get-signals',
  'pangular:get-providers',
  'pangular:get-ngrx-store',
  'pangular:build-meta',
  'pangular:lint-pipes',
  'pangular:analog-routes',
  'pangular:analog-explain-url',
  'pangular:analog-server-functions',
  'pangular:analog-api-routes',
  'pangular:analog-render-modes',
  'pangular:analog-prerender-plan',
  'pangular:analog-content',
]);

/**
 * Page scoped tools that stay MCP only: `screenshot-component` cannot hand
 * the image back through a page tool and runs a full capture, `highlight`
 * draws on the page and changes the selection in open panels,
 * `open-in-panel` switches open panels, and the NgRx session export and
 * import move whole recorded sessions in and out of the server.
 */
const MCP_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'pangular:screenshot-component',
  'pangular:highlight',
  'pangular:open-in-panel',
  'pangular:export-ngrx-session',
  'pangular:import-ngrx-session',
]);

/**
 * A server plugin's own tools stay MCP only: their handlers can read every
 * page the plugin sees, so the calling page's scope can't be enforced.
 */
const PLUGIN_TOOL_PREFIX = 'pangular:plugin:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function schemaOf(tool: ListedTool, host: BrowserToolHost): Record<string, unknown> {
  let schema: unknown = tool.inputSchema;
  if (schema === undefined) {
    const args =
      tool.kind === 'rpc' && tool.rpcName
        ? host.rpc.definitions.get(tool.rpcName)?.args
        : tool.args;
    try {
      schema = argsToJsonSchema(args as Parameters<typeof argsToJsonSchema>[0]);
    } catch {
      schema = undefined;
    }
  }
  return isRecord(schema) ? schema : { type: 'object', properties: {} };
}

function pageScoped(schema: Record<string, unknown>): boolean {
  const properties = schema['properties'];
  return isRecord(properties) && ('page' in properties || 'pageId' in properties);
}

/**
 * The Pangular tools that only read, as the server registered them under the
 * config: `inspectors`, `agent.tools` and `agent.readOnly` already decided
 * which exist, and `action` and `destructive` tools never reach the page.
 * Of those, only the ones scoped to one page or to the source (see
 * {@link SOURCE_TOOLS}).
 */
export function browserTools(host: BrowserToolHost): BrowserTool[] {
  const out: BrowserTool[] = [];
  const seen = new Set<string>();
  for (const tool of host.agent.list().tools) {
    if (!tool.id.startsWith('pangular:') || tool.safety !== 'read') continue;
    if (MCP_ONLY_TOOLS.has(tool.id) || tool.id.startsWith(PLUGIN_TOOL_PREFIX)) continue;
    const inputSchema = schemaOf(tool, host);
    if (!SOURCE_TOOLS.has(tool.id) && !pageScoped(inputSchema)) continue;
    const name = toAgentToolName(tool.id);
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      ...(tool.title && tool.title !== tool.id ? { title: tool.title } : {}),
      description: tool.description,
      inputSchema,
    });
  }
  return out;
}

/** Masks secrets in a tool's answer: secret JSON keys, credentials, JWTs and bearer tokens. */
export function redactAnswer(text: string): string {
  return redactText(redactJsonText(text, isSecretName));
}

function textOf(result: unknown): string {
  const markdown = isRecord(result) ? result['markdown'] : undefined;
  const text = typeof markdown === 'string' ? markdown : stringifyForMcp(result);
  return text.length > MAX_TEXT
    ? `${text.slice(0, MAX_TEXT)}\n\n… cut at ${MAX_TEXT} characters. Narrow the call with its arguments.`
    : text;
}

/**
 * The arguments for a call from a page: a tool that takes `page` (or
 * `pageId`) always answers for the calling page. A page or page id the
 * caller passed is replaced, so a page tool never reads another tab.
 */
export function scopedArgs(
  tool: BrowserTool,
  args: unknown,
  pageId: string,
): Record<string, unknown> {
  const out = isRecord(args) ? { ...args } : {};
  delete out['page'];
  delete out['pageId'];
  const properties = isRecord(tool.inputSchema['properties']) ? tool.inputSchema['properties'] : {};
  if ('page' in properties) out['page'] = pageId;
  if ('pageId' in properties) out['pageId'] = pageId;
  return out;
}

export interface BrowserToolOptions {
  /**
   * `agent.browserTools`, or the switch that starts from it: off answers no
   * tools and refuses calls.
   */
  enabled: boolean | (() => boolean);
  /** Whether the calling connection owns `pageId` (the shared owner check). */
  owns: (pageId: unknown) => pageId is string;
}

function isOn(options: BrowserToolOptions): boolean {
  return typeof options.enabled === 'function' ? options.enabled() : options.enabled;
}

export async function callBrowserTool(
  host: BrowserToolHost,
  message: unknown,
  options: BrowserToolOptions,
): Promise<BrowserToolAnswer> {
  if (!isOn(options)) {
    return {
      text: 'Browser tools are turned off (agent.browserTools, or Browser agent tools in the panel Settings).',
      isError: true,
    };
  }
  const request = isRecord(message) ? message : {};
  const pageId = request['pageId'];
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50 || !options.owns(pageId)) {
    return { text: 'This page is not connected to the devtools server.', isError: true };
  }
  const name = request['name'];
  const tool = browserTools(host).find((entry) => entry.name === name);
  if (!tool) {
    return {
      text: `No devtools page tool named ${JSON.stringify(String(name)).slice(0, 140)}.`,
      isError: true,
    };
  }
  const id = host.agent.list().tools.find((entry) => toAgentToolName(entry.id) === tool.name)!.id;
  try {
    const args = scopedArgs(tool, request['args'], pageId);
    const result = await callerScope.run(pageId, () => host.agent.invoke(id, args));
    return { text: redactAnswer(textOf(result)) };
  } catch (error) {
    // A refusal already says what to change; anything else failed.
    if (error instanceof ToolRefusal) return { text: redactAnswer(error.message), isError: true };
    const reason = (error as Error)?.message ?? String(error);
    return { text: redactAnswer(`${tool.name} failed: ${reason}`.slice(0, 2000)), isError: true };
  }
}

type Register = (definition: {
  name: string;
  type: 'query' | 'action';
  jsonSerializable: true;
  handler: (...args: any[]) => unknown;
}) => void;

/**
 * Registers `list-browser-tools` and `call-browser-tool`, and with a switch
 * `set-browser-tools` for the panel (shared RPC functions, not agent tools).
 */
export function registerBrowserTools(
  register: Register,
  host: BrowserToolHost,
  options: BrowserToolOptions & { switch?: BrowserToolsSwitch },
) {
  register({
    name: LIST_BROWSER_TOOLS,
    type: 'query',
    jsonSerializable: true,
    handler: () => (isOn(options) ? browserTools(host) : []),
  });
  const toggle = options.switch;
  if (toggle) {
    register({
      name: SET_BROWSER_TOOLS,
      type: 'action',
      jsonSerializable: true,
      handler: (message: unknown) => toggle.set(message),
    });
  }
  register({
    name: CALL_BROWSER_TOOL,
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => callBrowserTool(host, message, options),
  });
}
